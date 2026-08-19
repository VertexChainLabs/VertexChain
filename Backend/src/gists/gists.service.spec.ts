import { Test, TestingModule } from '@nestjs/testing';
import { GistsService } from './gists.service';
import { GistRepository } from './gist.repository';
import { GistWriteAttemptRepository } from './gist-write-attempt.repository';
import { computeGistRequestHash } from './idempotency-key.util';
import { GeoService } from '../geo/geo.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { SorobanService } from '../soroban/soroban.service';
import { CacheService } from '../cache/cache.service';
import { Gist } from './entities/gist.entity';
import { CreateGistDto } from './dto/create-gist.dto';
import { QueryGistsDto } from './dto/query-gists.dto';
import { UpdateGistDto } from './dto/update-gist.dto';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { StellarVerified } from '../auth/interfaces/stellar-verified.interface';

jest.mock('../common/utils/sanitize', () => ({
  stripHtml: jest.fn((text: string) => text),
}));

const mockGist = (overrides?: Partial<Gist>): Gist => ({
  id: 'uuid-1',
  content: 'Test gist',
  location_cell: 's1t7d8c',
  content_hash: 'mock_Qmabc123',
  stellar_gist_id: '1000',
  tx_hash: 'mock_tx_abc',
  author: 'GABC',
  author_verified_at: null,
  previous_cid: null,
  edited_at: null,
  location: null,
  lat: 9.0579,
  lon: 7.4951,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('GistsService', () => {
  let service: GistsService;
  let gistRepository: jest.Mocked<GistRepository>;
  let writeAttemptRepository: jest.Mocked<GistWriteAttemptRepository>;
  let geoService: jest.Mocked<GeoService>;
  let ipfsService: jest.Mocked<IpfsService>;
  let sorobanService: jest.Mocked<SorobanService>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GistsService,
        {
          provide: GistRepository,
          useValue: {
            create: jest.fn(),
            createCommitted: jest.fn(),
            findNearby: jest.fn(),
            findByGistId: jest.fn(),
            findByStellarGistId: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: GistWriteAttemptRepository,
          useValue: {
            findByKey: jest.fn(),
            createPending: jest.fn(),
            markChained: jest.fn(),
            markCommitted: jest.fn(),
          },
        },
        {
          provide: GeoService,
          useValue: { encode: jest.fn() },
        },
        {
          provide: IpfsService,
          useValue: { pinJson: jest.fn(), pinJsonBatch: jest.fn() },
        },
        {
          provide: SorobanService,
          useValue: { postGist: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            delPattern: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GistsService>(GistsService);
    gistRepository = module.get(GistRepository);
    writeAttemptRepository = module.get(GistWriteAttemptRepository);
    geoService = module.get(GeoService);
    ipfsService = module.get(IpfsService);
    sorobanService = module.get(SorobanService);
    cacheService = module.get(CacheService);

    // Default to a clean (no prior attempt) write path.
    writeAttemptRepository.findByKey.mockResolvedValue(null);
    writeAttemptRepository.createPending.mockResolvedValue(null);
    writeAttemptRepository.markChained.mockResolvedValue(null);
    writeAttemptRepository.markCommitted.mockResolvedValue(null);
  });

  describe('createBatch()', () => {
    it('pins the batch once, publishes concurrently, and returns all gists in order', async () => {
      const dtos: CreateGistDto[] = [
        { content: 'First', lat: 9.0579, lon: 7.4951 },
        { content: 'Second', lat: 9.058, lon: 7.4952, author: 'GABC' },
      ];
      geoService.encode.mockReturnValueOnce('cell-1').mockReturnValueOnce('cell-2');
      ipfsService.pinJsonBatch.mockResolvedValue([
        { cid: 'cid-1', mock: true },
        { cid: 'cid-2', mock: true },
      ]);
      sorobanService.postGist
        .mockResolvedValueOnce({ gistId: '1', txHash: 'tx-1', mock: true })
        .mockResolvedValueOnce({ gistId: '2', txHash: 'tx-2', mock: true });
      const stored = [mockGist(), { ...mockGist(), id: 'uuid-2', content: 'Second' }];
      gistRepository.create.mockResolvedValueOnce(stored[0]).mockResolvedValueOnce(stored[1]);
      cacheService.delPattern.mockResolvedValue();

      await expect(service.createBatch(dtos)).resolves.toEqual(stored);
      expect(ipfsService.pinJsonBatch).toHaveBeenCalledTimes(1);
      expect(ipfsService.pinJsonBatch).toHaveBeenCalledWith([
        expect.objectContaining({ content: 'First', location_cell: 'cell-1' }),
        expect.objectContaining({ content: 'Second', location_cell: 'cell-2' }),
      ]);
      // An unsigned `author` body field is ignored: both items are anonymous.
      expect(sorobanService.postGist).toHaveBeenNthCalledWith(1, 'cell-1', 'cid-1', null);
      expect(sorobanService.postGist).toHaveBeenNthCalledWith(2, 'cell-2', 'cid-2', null);
    });
  });

  describe('create()', () => {
    it('calls GeoService.encode with lat/lon', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'mock_Qmabc', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '1', txHash: 'tx1', mock: true });
      gistRepository.createCommitted.mockResolvedValue(mockGist());
      cacheService.delPattern.mockResolvedValue();

      await service.create(dto);

      expect(geoService.encode).toHaveBeenCalledWith(9.0579, 7.4951);
    });

    it('calls IpfsService.pinJson with content and location metadata', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'mock_Qmabc', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '1', txHash: 'tx1', mock: true });
      gistRepository.createCommitted.mockResolvedValue(mockGist());
      cacheService.delPattern.mockResolvedValue();

      await service.create(dto);

      expect(ipfsService.pinJson).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test',
          lat: 9.0579,
          lon: 7.4951,
          location_cell: 's1t7d8c',
        }),
      );
    });

    it('ignores an unsigned author body field and posts anonymously', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951, author: 'GABC' };
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'mock_Qmabc', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '1', txHash: 'tx1', mock: true });
      gistRepository.createCommitted.mockResolvedValue(mockGist());
      cacheService.delPattern.mockResolvedValue();

      await service.create(dto);

      expect(sorobanService.postGist).toHaveBeenCalledWith('s1t7d8c', 'mock_Qmabc', null);
    });

    it('calls GistRepository.createCommitted with all required fields', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'mock_Qmabc', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '42', txHash: 'tx42', mock: true });
      gistRepository.createCommitted.mockResolvedValue(mockGist());
      cacheService.delPattern.mockResolvedValue();

      await service.create(dto);

      expect(gistRepository.createCommitted).toHaveBeenCalledWith({
        content: 'Test',
        lat: 9.0579,
        lon: 7.4951,
        location_cell: 's1t7d8c',
        content_hash: 'mock_Qmabc',
        stellar_gist_id: '42',
        tx_hash: 'tx42',
        author: undefined,
        author_verified_at: null,
      });
    });

    it('returns the gist created by the repository', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      const gist = mockGist();
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'cid1', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '1', txHash: 'tx', mock: true });
      gistRepository.createCommitted.mockResolvedValue(gist);
      cacheService.delPattern.mockResolvedValue();

      const result = await service.create(dto);

      expect(result).toBe(gist);
    });

    it('does not re-post to the chain when a retry follows a failed DB insert', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      const idempotencyKey = 'key-retry';
      const requestHash = computeGistRequestHash({
        content: 'Test',
        lat: 9.0579,
        lon: 7.4951,
      });
      const chainedAttempt = {
        id: 'attempt-1',
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        content: 'Test',
        lat: 9.0579,
        lon: 7.4951,
        location_cell: 's1t7d8c',
        content_hash: 'cid-1',
        author: null,
        author_verified_at: null,
        stellar_gist_id: '42',
        tx_hash: 'tx-42',
        gist_id: null,
        status: 'chained' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'cid-1', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '42', txHash: 'tx-42', mock: true });
      cacheService.delPattern.mockResolvedValue();

      // First attempt: fresh path, then the final DB insert fails.
      writeAttemptRepository.findByKey.mockResolvedValue(null);
      writeAttemptRepository.markChained.mockResolvedValue(chainedAttempt);
      gistRepository.createCommitted.mockRejectedValueOnce(
        new Error('Postgres briefly unavailable'),
      );

      await expect(service.create(dto, null, idempotencyKey)).rejects.toThrow(
        'Postgres briefly unavailable',
      );
      expect(sorobanService.postGist).toHaveBeenCalledTimes(1);

      // Retry with the same key: the attempt is now 'chained', so the chain
      // write is skipped and only the DB insert is retried.
      writeAttemptRepository.findByKey.mockResolvedValue(chainedAttempt);
      gistRepository.createCommitted.mockResolvedValueOnce(mockGist());

      const result = await service.create(dto, null, idempotencyKey);

      expect(result).toEqual(mockGist());
      expect(sorobanService.postGist).toHaveBeenCalledTimes(1); // still once
      expect(gistRepository.createCommitted).toHaveBeenCalledTimes(2);
      expect(writeAttemptRepository.markCommitted).toHaveBeenCalledWith(idempotencyKey, 'uuid-1');
    });

    it('replays a committed attempt without re-posting or re-inserting', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      const idempotencyKey = 'key-committed';
      const committedAttempt = {
        id: 'attempt-1',
        idempotency_key: idempotencyKey,
        request_hash: computeGistRequestHash({ content: 'Test', lat: 9.0579, lon: 7.4951 }),
        content: 'Test',
        lat: 9.0579,
        lon: 7.4951,
        location_cell: 's1t7d8c',
        content_hash: 'cid-1',
        author: null,
        author_verified_at: null,
        stellar_gist_id: '42',
        tx_hash: 'tx-42',
        gist_id: 'uuid-1',
        status: 'committed' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };
      const stored = mockGist();

      writeAttemptRepository.findByKey.mockResolvedValue(committedAttempt);
      gistRepository.findByGistId.mockResolvedValue(stored);

      const result = await service.create(dto, null, idempotencyKey);

      expect(result).toBe(stored);
      expect(sorobanService.postGist).not.toHaveBeenCalled();
      expect(ipfsService.pinJson).not.toHaveBeenCalled();
      expect(gistRepository.createCommitted).not.toHaveBeenCalled();
    });

    it('rejects a reused idempotency key that maps to a different request', async () => {
      const dto: CreateGistDto = { content: 'Test', lat: 9.0579, lon: 7.4951 };
      const idempotencyKey = 'key-reused';
      const priorAttempt = {
        id: 'attempt-1',
        idempotency_key: idempotencyKey,
        request_hash: computeGistRequestHash({ content: 'Different', lat: 9.0579, lon: 7.4951 }),
        content: 'Different',
        lat: 9.0579,
        lon: 7.4951,
        location_cell: 's1t7d8c',
        content_hash: 'cid-other',
        author: null,
        author_verified_at: null,
        stellar_gist_id: '42',
        tx_hash: 'tx-42',
        gist_id: null,
        status: 'chained' as const,
        created_at: new Date(),
        updated_at: new Date(),
      };

      writeAttemptRepository.findByKey.mockResolvedValue(priorAttempt);

      await expect(service.create(dto, null, idempotencyKey)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(sorobanService.postGist).not.toHaveBeenCalled();
    });
  });

  describe('findNearby()', () => {
    const query: QueryGistsDto = { lat: 9.0579, lon: 7.4951, radius: 500, limit: 20 };
    const paginatedResult = {
      data: [mockGist()],
      pagination: { count: 1, cursor: null, hasMore: false },
    };

    it('returns cached result when cache hit occurs', async () => {
      cacheService.get.mockResolvedValue(paginatedResult);

      const result = await service.findNearby(query);

      expect(result).toBe(paginatedResult);
      expect(gistRepository.findNearby).not.toHaveBeenCalled();
    });

    it('calls GistRepository.findNearby on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      gistRepository.findNearby.mockResolvedValue(paginatedResult);

      await service.findNearby(query);

      expect(gistRepository.findNearby).toHaveBeenCalledWith({
        lat: 9.0579,
        lon: 7.4951,
        radiusMeters: 500,
        limit: 20,
        cursor: undefined,
      });
    });

    it('skips cache and calls repository directly when cursor is present', async () => {
      const queryWithCursor = { ...query, cursor: '2026-01-01T00:00:00.000Z' };
      gistRepository.findNearby.mockResolvedValue(paginatedResult);

      await service.findNearby(queryWithCursor);

      expect(cacheService.get).not.toHaveBeenCalled();
      expect(gistRepository.findNearby).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: '2026-01-01T00:00:00.000Z' }),
      );
    });
  });

  describe('nearby cache invalidation', () => {
    it('invalidates with the same full-precision coordinates findNearby caches with', async () => {
      const lat = 9.0579123;
      const lon = 7.4951567;
      const paginatedResult = {
        data: [mockGist()],
        pagination: { count: 1, cursor: null, hasMore: false },
      };

      // Capture the cache key findNearby would write for a query at this coordinate.
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      gistRepository.findNearby.mockResolvedValue(paginatedResult);
      await service.findNearby({ lat, lon, radius: 500, limit: 20 });
      const cacheKey = cacheService.set.mock.calls[0][0] as string;

      // Post a gist at the same coordinate and capture the invalidation pattern.
      geoService.encode.mockReturnValue('s1t7d8c');
      ipfsService.pinJson.mockResolvedValue({ cid: 'mock_Qmabc', mock: true });
      sorobanService.postGist.mockResolvedValue({ gistId: '1', txHash: 'tx1', mock: true });
      gistRepository.createCommitted.mockResolvedValue(mockGist());
      cacheService.delPattern.mockResolvedValue();

      await service.create({ content: 'Test', lat, lon });

      const pattern = cacheService.delPattern.mock.calls[0][0] as string;

      // The pattern uses the raw (unrounded) coordinates and its `*` suffix
      // matches the key findNearby actually wrote.
      expect(pattern).toBe(`gist:nearby:${lat}:${lon}:*`);
      expect(cacheKey.startsWith(pattern.slice(0, -1))).toBe(true);
    });
  });

  describe('findOne()', () => {
    it('returns cached gist on cache hit', async () => {
      const gist = mockGist();
      cacheService.get.mockResolvedValue(gist);

      const result = await service.findOne('uuid-1');

      expect(result).toBe(gist);
      expect(gistRepository.findByGistId).not.toHaveBeenCalled();
    });

    it('calls GistRepository.findByGistId on cache miss', async () => {
      const gist = mockGist();
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      gistRepository.findByGistId.mockResolvedValue(gist);

      const result = await service.findOne('uuid-1');

      expect(gistRepository.findByGistId).toHaveBeenCalledWith('uuid-1');
      expect(result).toBe(gist);
    });

    it('returns null when gist not found', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue();
      gistRepository.findByGistId.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update()', () => {
    const dto: UpdateGistDto = { content: 'Fixed typo' };
    const verified = (address: string): StellarVerified => ({
      address,
      verifiedAt: new Date(),
    });

    it('throws NotFoundException when gist does not exist', async () => {
      gistRepository.findByGistId.mockResolvedValue(null);

      await expect(service.update('missing', dto, verified('GABC'))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 410 Gone when the 60s edit window has closed', async () => {
      const gist = mockGist({ created_at: new Date(Date.now() - 61_000) });
      gistRepository.findByGistId.mockResolvedValue(gist);

      await expect(service.update('uuid-1', dto, verified('GABC'))).rejects.toMatchObject({
        status: 410,
      });
      expect(gistRepository.update).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the signature is absent', async () => {
      // Spoofing scenario: the body author matches the stored author, but there
      // is no verified signature, so the edit must be rejected.
      const gist = mockGist({ created_at: new Date(), author: 'GABC' });
      gistRepository.findByGistId.mockResolvedValue(gist);

      await expect(service.update('uuid-1', { ...dto, author: 'GABC' }, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(gistRepository.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the signed address does not match', async () => {
      const gist = mockGist({ created_at: new Date(), author: 'GOTHER' });
      gistRepository.findByGistId.mockResolvedValue(gist);

      await expect(service.update('uuid-1', dto, verified('GABC'))).rejects.toThrow(
        ForbiddenException,
      );
      expect(gistRepository.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when gist has no stored author', async () => {
      const gist = mockGist({ created_at: new Date(), author: null });
      gistRepository.findByGistId.mockResolvedValue(gist);

      await expect(service.update('uuid-1', dto, verified('GABC'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('records lineage from the previous content_hash to a new cid', async () => {
      const gist = mockGist({ created_at: new Date(), author: 'GABC', content_hash: 'old_cid' });
      gistRepository.findByGistId.mockResolvedValue(gist);
      ipfsService.pinJson.mockResolvedValue({ cid: 'new_cid', mock: true });
      gistRepository.update.mockResolvedValue(mockGist({ content_hash: 'new_cid' }));
      cacheService.del.mockResolvedValue();
      cacheService.delPattern.mockResolvedValue();

      await service.update('uuid-1', dto, verified('GABC'));

      expect(gistRepository.update).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({
          content: 'Fixed typo',
          content_hash: 'new_cid',
          previous_cid: 'old_cid',
        }),
      );
    });

    it('invalidates the single-gist and nearby caches after a successful edit', async () => {
      const gist = mockGist({ created_at: new Date() });
      gistRepository.findByGistId.mockResolvedValue(gist);
      ipfsService.pinJson.mockResolvedValue({ cid: 'new_cid', mock: true });
      gistRepository.update.mockResolvedValue(mockGist());
      cacheService.del.mockResolvedValue();
      cacheService.delPattern.mockResolvedValue();

      await service.update('uuid-1', dto, verified('GABC'));

      expect(cacheService.del).toHaveBeenCalledWith('gist:one:uuid-1');
      expect(cacheService.delPattern).toHaveBeenCalled();
    });

    it('returns the updated gist from the repository', async () => {
      const gist = mockGist({ created_at: new Date() });
      const updated = mockGist({ content: 'Fixed typo', content_hash: 'new_cid' });
      gistRepository.findByGistId.mockResolvedValue(gist);
      ipfsService.pinJson.mockResolvedValue({ cid: 'new_cid', mock: true });
      gistRepository.update.mockResolvedValue(updated);
      cacheService.del.mockResolvedValue();
      cacheService.delPattern.mockResolvedValue();

      const result = await service.update('uuid-1', dto, verified('GABC'));

      expect(result).toBe(updated);
    });
  });
});
