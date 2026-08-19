import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGistWriteAttempts1700000000004 implements MigrationInterface {
  name = 'AddGistWriteAttempts1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Durable idempotency ledger for the gist write path. One row per logical
    // post attempt, keyed by the client Idempotency-Key (or a content-derived
    // fallback). The row survives the irreversible Soroban write so a retry can
    // resume instead of posting a second on-chain gist.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gist_write_attempts" (
        "id"                 UUID             NOT NULL DEFAULT gen_random_uuid(),
        "idempotency_key"    VARCHAR(255)     NOT NULL,
        "request_hash"       VARCHAR(64)      NOT NULL,
        "content"            TEXT             NOT NULL,
        "lat"                DOUBLE PRECISION NOT NULL,
        "lon"                DOUBLE PRECISION NOT NULL,
        "location_cell"      VARCHAR(20),
        "content_hash"       VARCHAR(100),
        "author"             VARCHAR(80),
        "author_verified_at" TIMESTAMPTZ,
        "stellar_gist_id"    VARCHAR(80),
        "tx_hash"            VARCHAR(80),
        "gist_id"            UUID,
        "status"             VARCHAR(16)      NOT NULL DEFAULT 'pending',
        "created_at"         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_gist_write_attempts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_gist_write_attempts_idempotency_key" UNIQUE ("idempotency_key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_gist_write_attempts_content_hash"
        ON "gist_write_attempts" ("content_hash", "location_cell")
    `);

    // Enforce on-chain id dedup at the DB layer. Required for GistRepository's
    // `ON CONFLICT (stellar_gist_id)` clauses (`upsertFromEvent` and the new
    // idempotent `createCommitted` insert) to actually resolve. Postgres treats
    // NULLs as distinct in a unique index, so pending rows (no on-chain id yet)
    // are unaffected.
    //
    // Precondition: no existing duplicate non-NULL `stellar_gist_id` rows.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gists_stellar_gist_id"
        ON "gists" ("stellar_gist_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_gists_stellar_gist_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_gist_write_attempts_content_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gist_write_attempts"`);
  }
}
