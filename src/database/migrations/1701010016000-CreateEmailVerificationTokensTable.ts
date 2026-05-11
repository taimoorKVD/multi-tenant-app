import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailVerificationTokensTable1701010016000 implements MigrationInterface {
  name = 'CreateEmailVerificationTokensTable1701010016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
        "id" SERIAL NOT NULL,
        "token_hash" character varying(128) NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "verified_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" integer NOT NULL,
        CONSTRAINT "PK_email_verification_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_verification_tokens_user_id" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_token_hash" ON "email_verification_tokens" ("token_hash")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_expires_at" ON "email_verification_tokens" ("expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_verification_tokens_user_id" ON "email_verification_tokens" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_verification_tokens_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_verification_tokens_expires_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_verification_tokens_token_hash"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_verification_tokens"');
  }
}