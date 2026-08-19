import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebsiteSignupsTable1701010023000 implements MigrationInterface {
  name = 'CreateWebsiteSignupsTable1701010023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "website_signups_status_enum" AS ENUM (
          'pending', 'paid', 'provisioned', 'failed', 'expired'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "website_signups"
      (
        "id"                          UUID         NOT NULL DEFAULT gen_random_uuid(),
        "plan_id"                     INTEGER      NOT NULL,
        "email"                       VARCHAR(255) NOT NULL,
        "payload"                     JSONB        NOT NULL,
        "admin_password_encrypted"    TEXT         NOT NULL,
        "stripe_checkout_session_id"  VARCHAR(255),
        "stripe_customer_id"          VARCHAR(255),
        "stripe_subscription_id"      VARCHAR(255),
        "tenant_id"                   INTEGER,
        "status"                      "website_signups_status_enum" NOT NULL DEFAULT 'pending',
        "error_message"               TEXT,
        "created_at"                  TIMESTAMPTZ  DEFAULT now(),
        "updated_at"                  TIMESTAMPTZ  DEFAULT now(),
        CONSTRAINT "PK_website_signups_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_website_signups_checkout_session"
      ON "website_signups" ("stripe_checkout_session_id")
      WHERE "stripe_checkout_session_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "website_signups"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "website_signups_status_enum"`);
  }
}
