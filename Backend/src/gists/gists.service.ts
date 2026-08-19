import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateGistDto } from './dto/create-gist.dto';
import { QueryGistsDto } from './dto/query-gists.dto';
import { UpdateGistDto } from './dto/update-gist.dto';
import { GistRepository } from './gist.repository';
import { GistWriteAttempt, GistWriteAttemptRepository } from './gist-write-attempt.repository';
import { computeGistRequestHash } from './idempotency-key.util';
import { GeoService } from '../geo/geo.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { SorobanService } from '../soroban/soroban.service';
import { CacheService } from '../cache/cache.service';
import { Gist } from './entities/gist.entity';
import { PaginatedResponse } from '../common/utils/pagination.helper';
import { stripHtml } from '../common/utils/sanitize';
import { StellarVerified } from '../auth/interfaces/stellar-verified.interface';

const EDIT_WINDOW_MS = 60_000;

/**
 * Shared prefix for nearby-cache keys. Both the cache key written by
 * `findNearby` and the invalidation pattern used by `invalidateNearbyCache`
 * must derive from the same coordinate serialization; otherwise a rounded
 * pattern misses the full-precision keys the query actually writes.
 */
function nearbyCachePrefix(lat: number, lon: number): string {
  return `gist:nearby:${lat}:${lon}`;
}

/** Full cache key for an uncursor'd nearby query. */
function nearbyCacheKey(lat: number, lon: number, radius?: number, limit?: number): string {
  return `${nearbyCachePrefix(lat, lon)}:${radius || 500}:${limit || 20}`;
}

@Injectable()
export class GistsService {
  private readonly logger = new Logger(GistsService.name);

  constructor(
    private readonly gistRepository: GistRepository,
    private readonly writeAttemptRepository: GistWriteAttemptRepository,
    private readonly geoService: GeoService,
    private readonly ipfsService: IpfsService,
    private readonly sorobanService: SorobanService,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    dto: CreateGistDto,
    stellarVerified?: StellarVerified | null,
    idempotencyKey?: string,
  ): Promise<Gist> {
    // Issue 87 — sanitize content before storing
    const content = stripHtml(dto.content);

    const locationCell = this.geoService.encode(dto.lat, dto.lon);

    // Authorship comes only from a verified Stellar signature. An unsigned
    // `dto.author` field is ignored so a client cannot attribute a gist to an
    // arbitrary address.
    const author = stellarVerified ? stellarVerified.address : null;
    const authorVerifiedAt = stellarVerified ? stellarVerified.verifiedAt : null;

    const requestHash = computeGistRequestHash({
      content,
      lat: dto.lat,
      lon: dto.lon,
      author,
    });
    const key = idempotencyKey ?? requestHash;

    // 1. Resume any prior attempt for the same logical post instead of
    //    re-pinning and re-posting to the chain.
    const existing = await this.writeAttemptRepository.findByKey(key);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new UnprocessableEntityException(
          'Idempotency-Key already used with a different request',
        );
      }
      return this.resumeAttempt(existing);
    }

    // 2. Pin content to IPFS. Content-addressed, so retrying produces the same
    //    CID — this step is naturally idempotent.
    const { cid } = await this.ipfsService.pinJson({
      content,
      lat: dto.lat,
      lon: dto.lon,
      location_cell: locationCell,
      created_at: new Date().toISOString(),
    });

    // 3. Durable pending record BEFORE the irreversible on-chain write.
    const created = await this.writeAttemptRepository.createPending({
      idempotency_key: key,
      request_hash: requestHash,
      content,
      lat: dto.lat,
      lon: dto.lon,
      location_cell: locationCell,
      content_hash: cid,
      author: author ?? null,
      author_verified_at: authorVerifiedAt,
    });

    const pending = created ?? (await this.writeAttemptRepository.findByKey(key));
    if (pending && pending.status !== 'pending') {
      // Lost a race — another request already advanced this attempt. Resume it.
      return this.resumeAttempt(pending);
    }

    // 4. Irreversible on-chain write.
    const { gistId, txHash } = await this.sorobanService.postGist(locationCell, cid, author);

    this.logger.log(`Gist posted → cell=${locationCell} cid=${cid} gistId=${gistId}`);

    // 5. Durable record of the chain result, kept separate from the final DB
    //    insert so a failure between them does not lose the on-chain id.
    const chained = await this.writeAttemptRepository.markChained(key, gistId, txHash);
    if (chained === null) {
      // Another request advanced (or removed) this attempt while we were on
      // the chain. Re-read and resume instead of re-inserting blindly.
      const attempt = await this.writeAttemptRepository.findByKey(key);
      if (attempt) {
        return this.resumeAttempt(attempt);
      }
    }

    return this.persistAndCommit(
      {
        idempotency_key: key,
        content,
        lat: dto.lat,
        lon: dto.lon,
        location_cell: locationCell,
        content_hash: cid,
        author: author ?? null,
        author_verified_at: authorVerifiedAt,
      },
      gistId,
      txHash,
    );
  }

  /**
   * Finishes a prior attempt without re-posting to the chain.
   *
   * - `committed` → return the already-persisted gist.
   * - `chained`   → the chain write already happened; only the DB insert remains.
   * - `pending`   → no durable evidence the chain write happened, so it is re-submitted.
   */
  private async resumeAttempt(attempt: GistWriteAttempt): Promise<Gist> {
    if (attempt.status === 'committed') {
      if (attempt.gist_id) {
        const gist = await this.gistRepository.findByGistId(attempt.gist_id);
        if (gist) {
          return gist;
        }
      }
      // `committed` implies the gists row exists; if it was pruned, fall through
      // to the idempotent insert rather than minting a second on-chain gist.
      return this.finishChained(attempt);
    }

    if (attempt.status === 'chained') {
      return this.finishChained(attempt);
    }

    // 'pending' — resume from the already-pinned CID.
    const locationCell = attempt.location_cell ?? this.geoService.encode(attempt.lat, attempt.lon);
    const { gistId, txHash } = await this.sorobanService.postGist(
      locationCell,
      attempt.content_hash ?? '',
      attempt.author ?? undefined,
    );

    this.logger.log(
      `Gist re-posted (pending resume) → cell=${locationCell} cid=${attempt.content_hash} gistId=${gistId}`,
    );

    await this.writeAttemptRepository.markChained(attempt.idempotency_key, gistId, txHash);
    return this.persistAndCommit(attempt, gistId, txHash);
  }

  private async finishChained(attempt: GistWriteAttempt): Promise<Gist> {
    if (!attempt.stellar_gist_id) {
      throw new Error(
        `gist_write_attempt ${attempt.id} is ${attempt.status} but has no stellar_gist_id`,
      );
    }
    return this.persistAndCommit(attempt, attempt.stellar_gist_id, attempt.tx_hash ?? '');
  }

  private async persistAndCommit(
    attempt: Pick<
      GistWriteAttempt,
      | 'idempotency_key'
      | 'content'
      | 'lat'
      | 'lon'
      | 'location_cell'
      | 'content_hash'
      | 'author'
      | 'author_verified_at'
    >,
    gistId: string,
    txHash: string,
  ): Promise<Gist> {
    const gist = await this.gistRepository.createCommitted({
      content: attempt.content,
      lat: attempt.lat,
      lon: attempt.lon,
      location_cell: attempt.location_cell ?? undefined,
      content_hash: attempt.content_hash ?? undefined,
      stellar_gist_id: gistId,
      tx_hash: txHash,
      author: attempt.author ?? undefined,
      author_verified_at: attempt.author_verified_at ?? null,
    });

    await this.writeAttemptRepository.markCommitted(attempt.idempotency_key, gist.id);

    // Invalidate nearby cache for the affected area
    await this.invalidateNearbyCache(attempt.lat, attempt.lon);

    return gist;
  }

  async createBatch(
    dtos: CreateGistDto[],
    stellarVerified?: StellarVerified | null,
  ): Promise<Gist[]> {
    const createdAt = new Date().toISOString();
    // Authorship comes only from a verified Stellar signature; per-item
    // `dto.author` fields are ignored.
    const author = stellarVerified ? stellarVerified.address : null;
    const authorVerifiedAt = stellarVerified ? stellarVerified.verifiedAt : null;

    const prepared = dtos.map((dto) => {
      const content = stripHtml(dto.content);
      const locationCell = this.geoService.encode(dto.lat, dto.lon);

      return {
        dto,
        content,
        locationCell,
        effectiveAuthor: author,
        payload: {
          content,
          lat: dto.lat,
          lon: dto.lon,
          location_cell: locationCell,
          created_at: createdAt,
        },
      };
    });

    const pins = await this.ipfsService.pinJsonBatch(prepared.map(({ payload }) => payload));

    const gists = await Promise.all(
      prepared.map(async ({ dto, content, locationCell, effectiveAuthor }, index) => {
        const { cid } = pins[index];
        const { gistId, txHash } = await this.sorobanService.postGist(
          locationCell,
          cid,
          effectiveAuthor,
        );

        this.logger.log(`Batch gist posted → cell=${locationCell} cid=${cid} gistId=${gistId}`);

        return this.gistRepository.create({
          content,
          lat: dto.lat,
          lon: dto.lon,
          location_cell: locationCell,
          content_hash: cid,
          stellar_gist_id: gistId,
          tx_hash: txHash,
          author: effectiveAuthor,
          author_verified_at: authorVerifiedAt,
        });
      }),
    );

    await Promise.all(
      [...new Map(dtos.map(({ lat, lon }) => [`${lat}:${lon}`, { lat, lon }])).values()].map(
        ({ lat, lon }) => this.invalidateNearbyCache(lat, lon),
      ),
    );

    return gists;
  }

  async findNearby(query: QueryGistsDto): Promise<PaginatedResponse<Gist>> {
    // Don't cache paginated results (when cursor is present)
    if (query.cursor) {
      return this.gistRepository.findNearby({
        lat: query.lat,
        lon: query.lon,
        radiusMeters: query.radius,
        limit: query.limit,
        cursor: query.cursor,
      });
    }

    const cacheKey = nearbyCacheKey(query.lat, query.lon, query.radius, query.limit);
    const cached = await this.cacheService.get<PaginatedResponse<Gist>>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for nearby query: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for nearby query: ${cacheKey}`);
    const result = await this.gistRepository.findNearby({
      lat: query.lat,
      lon: query.lon,
      radiusMeters: query.radius,
      limit: query.limit,
      cursor: query.cursor,
    });

    // Cache for 60 seconds
    await this.cacheService.set(cacheKey, result, 60);

    return result;
  }

  async findOne(id: string): Promise<Gist | null> {
    const cacheKey = `gist:one:${id}`;
    const cached = await this.cacheService.get<Gist>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for gist: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for gist: ${cacheKey}`);
    const result = await this.gistRepository.findByGistId(id);

    if (result) {
      // Cache for 300 seconds (5 minutes)
      await this.cacheService.set(cacheKey, result, 300);
    }

    return result;
  }

  async update(
    id: string,
    dto: UpdateGistDto,
    stellarVerified?: StellarVerified | null,
  ): Promise<Gist> {
    const gist = await this.gistRepository.findByGistId(id);

    if (!gist) {
      throw new NotFoundException(`Gist ${id} not found`);
    }

    const elapsedMs = Date.now() - new Date(gist.created_at).getTime();
    if (elapsedMs > EDIT_WINDOW_MS) {
      throw new HttpException('Edit window has closed for this gist', HttpStatus.GONE);
    }

    // Authorship is derived from the verified Stellar signature, never the
    // caller-supplied `dto.author` string (which is trivially spoofable).
    const verifiedAddress = stellarVerified?.address ?? null;
    if (!verifiedAddress) {
      throw new UnauthorizedException('A valid Stellar signature is required to edit a gist');
    }
    if (!gist.author || gist.author !== verifiedAddress) {
      throw new ForbiddenException('Only the original author may edit this gist');
    }

    const content = stripHtml(dto.content);

    const { cid } = await this.ipfsService.pinJson({
      content,
      lat: gist.lat,
      lon: gist.lon,
      location_cell: gist.location_cell,
      created_at: new Date().toISOString(),
    });

    const updated = await this.gistRepository.update(id, {
      content,
      content_hash: cid,
      previous_cid: gist.content_hash,
      edited_at: new Date(),
    });

    this.logger.log(`Gist edited → id=${id} previous_cid=${gist.content_hash} new_cid=${cid}`);

    await this.cacheService.del(`gist:one:${id}`);
    await this.invalidateNearbyCache(gist.lat, gist.lon);

    return updated as Gist;
  }

  private async invalidateNearbyCache(lat: number, lon: number): Promise<void> {
    // Invalidate every radius/limit variant for this coordinate, using the
    // same coordinate serialization findNearby uses for its cache keys.
    const pattern = `${nearbyCachePrefix(lat, lon)}:*`;
    await this.cacheService.delPattern(pattern);
    this.logger.debug(`Invalidated nearby cache pattern: ${pattern}`);
  }
}
