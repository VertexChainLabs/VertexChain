import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRegionsTable1700000000002 implements MigrationInterface {
  name = 'CreateRegionsTable1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "regions" (
        "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
        "name"       VARCHAR(255) NOT NULL,
        "polygon"    JSONB        NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_regions_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "regions"`);
  }
}
