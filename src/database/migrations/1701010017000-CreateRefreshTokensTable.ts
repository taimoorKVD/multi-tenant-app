import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1701010017000 implements MigrationInterface {
  name = 'CreateRefreshTokensTable1701010017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" SERIAL NOT NULL,
        "token_hash" character varying(128) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "device_name" character varying(128),
        "ip_address" character varying(64),
        "user_agent" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_expires_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_refresh_tokens_token_hash"');
    await queryRunner.query('DROP TABLE IF EXISTS "refresh_tokens"');
  }
}