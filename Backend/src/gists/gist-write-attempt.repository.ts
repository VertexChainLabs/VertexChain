import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Lifecycle of a gist write attempt:
 *
 *   pending   — the attempt is recorded and IPFS has been pinned, but the
 *               irreversible on-chain write has not yet been recorded.
 *   chained   — the on-chain write completed and its `stellar_gist_id` /
 *               `tx_hash` are durably stored; only the final Postgres insert
 *               into `gists` remains.
 *   committed — the `gists` row exists and is referenced by `gist_id`.
 *
 * The transition from `pending` to `chained` is what makes a retry idempotent:
 * once the on-chain id is durable, a later retry can finish the DB insert
 * without calling Soroban a second time.
 */
export type GistWriteAttemptStatus = 'pending' | 'chained' | 'committed';

export interface GistWriteAttempt {
  id: string;
  idempotency_key: string;
  request_hash: string;
  content: string;
  lat: number;
  lon: number;
  location_cell: string | null;
  content_hash: string | null;
  author: string | null;
  author_verified_at: Date | null;
  stellar_gist_id: string | null;
  tx_hash: string | null;
  gist_id: string | null;
  status: GistWriteAttemptStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePendingAttemptData {
  idempotency_key: string;
  request_hash: string;
  content: string;
  lat: number;
  lon: number;
  location_cell: string;
  content_hash: string;
  author: string | null;
  author_verified_at: Date | null;
}

const ATTEMPT_COLUMNS = `
  id, idempotency_key, request_hash, content, lat, lon, location_cell,
  content_hash, author, author_verified_at, stellar_gist_id, tx_hash,
  gist_id, status, created_at, updated_at
`;

@Injectable()
export class GistWriteAttemptRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findByKey(idempotencyKey: string): Promise<GistWriteAttempt | null> {
    const rows = await this.dataSource.query<GistWriteAttempt[]>(
      `SELECT ${ATTEMPT_COLUMNS} FROM gist_write_attempts WHERE idempotency_key = $1 LIMIT 1`,
      [idempotencyKey],
    );
    return rows[0] ?? null;
  }

  /**
   * Inserts a pending attempt. Returns `null` when the key already exists
   * (a concurrent request won the insert), so the caller re-reads the winner
   * and resumes from its state instead of proceeding in parallel.
   */
  async createPending(data: CreatePendingAttemptData): Promise<GistWriteAttempt | null> {
    const rows = await this.dataSource.query<GistWriteAttempt[]>(
      `
      INSERT INTO gist_write_attempts (
        idempotency_key, request_hash, content, lat, lon, location_cell,
        content_hash, author, author_verified_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING ${ATTEMPT_COLUMNS}
      `,
      [
        data.idempotency_key,
        data.request_hash,
        data.content,
        data.lat,
        data.lon,
        data.location_cell,
        data.content_hash,
        data.author,
        data.author_verified_at,
      ],
    );
    return rows[0] ?? null;
  }

  /**
   * Records the result of the irreversible on-chain write. Only advances a
   * `pending` attempt; returns `null` if the attempt was already advanced by
   * a concurrent request, in which case the caller must re-read and resume.
   */
  async markChained(
    idempotencyKey: string,
    stellarGistId: string,
    txHash: string,
  ): Promise<GistWriteAttempt | null> {
    const rows = await this.dataSource.query<GistWriteAttempt[]>(
      `
      UPDATE gist_write_attempts
      SET stellar_gist_id = $2,
          tx_hash = $3,
          status = 'chained',
          updated_at = NOW()
      WHERE idempotency_key = $1 AND status = 'pending'
      RETURNING ${ATTEMPT_COLUMNS}
      `,
      [idempotencyKey, stellarGistId, txHash],
    );
    return rows[0] ?? null;
  }

  async markCommitted(idempotencyKey: string, gistId: string): Promise<GistWriteAttempt | null> {
    const rows = await this.dataSource.query<GistWriteAttempt[]>(
      `
      UPDATE gist_write_attempts
      SET gist_id = $2,
          status = 'committed',
          updated_at = NOW()
      WHERE idempotency_key = $1 AND status IN ('pending', 'chained')
      RETURNING ${ATTEMPT_COLUMNS}
      `,
      [idempotencyKey, gistId],
    );
    return rows[0] ?? null;
  }
}
