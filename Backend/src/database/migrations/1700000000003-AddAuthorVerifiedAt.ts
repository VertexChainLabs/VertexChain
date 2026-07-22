import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthorVerifiedAt1700000000003 implements MigrationInterface {
  name = 'AddAuthorVerifiedAt1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "gists"
        ADD COLUMN IF NOT EXISTS "author_verified_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "gists" DROP COLUMN IF EXISTS "author_verified_at"`);
  }
}
