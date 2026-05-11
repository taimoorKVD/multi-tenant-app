import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasswordResetTokensTable1701010015000 implements MigrationInterface {
  name = 'CreatePasswordResetTokensTable1701010015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" SERIAL NOT NULL,
        "token_hash" character varying(128) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "requested_ip" character varying(64),
        "user_agent" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_password_reset_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user_id" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_token_hash" ON "password_reset_tokens" ("token_hash")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_password_reset_tokens_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_password_reset_tokens_expires_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_password_reset_tokens_token_hash"');
    await queryRunner.query('DROP TABLE IF EXISTS "password_reset_tokens"');
  }
}