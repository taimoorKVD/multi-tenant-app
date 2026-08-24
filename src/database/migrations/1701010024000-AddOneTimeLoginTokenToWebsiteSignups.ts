import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOneTimeLoginTokenToWebsiteSignups1701010024000 implements MigrationInterface {
  name = 'AddOneTimeLoginTokenToWebsiteSignups1701010024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "website_signups"
      ADD COLUMN IF NOT EXISTS "one_time_login_token_hash" VARCHAR(128),
      ADD COLUMN IF NOT EXISTS "one_time_login_token_expires_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "one_time_login_token_used_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_website_signups_ott_hash"
      ON "website_signups" ("one_time_login_token_hash")
      WHERE "one_time_login_token_hash" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_website_signups_ott_hash"`);
    await queryRunner.query(`
      ALTER TABLE "website_signups"
      DROP COLUMN IF EXISTS "one_time_login_token_used_at",
      DROP COLUMN IF EXISTS "one_time_login_token_expires_at",
      DROP COLUMN IF EXISTS "one_time_login_token_hash"
    `);
  }
}
