import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailLogsTable1701010010000 implements MigrationInterface {
  name = 'CreateEmailLogsTable1701010010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_logs" (
        "id" SERIAL NOT NULL,
        "tenant_id" character varying(100),
        "module" character varying(80) NOT NULL,
        "action" character varying(80) NOT NULL,
        "template_id" integer NOT NULL,
        "template_version" integer NOT NULL DEFAULT 1,
        "template_name" character varying(150) NOT NULL,
        "idempotency_key" character varying(255) NOT NULL,
        "to" text NOT NULL,
        "cc" text,
        "bcc" text,
        "subject" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "provider" character varying(50),
        "smtp_host" character varying(255),
        "from_email" character varying(255),
        "retry_count" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "transport_message_id" text,
        "last_attempt_at" TIMESTAMP,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_logs_idempotency_key" UNIQUE ("idempotency_key")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_logs_tenant_module_action" ON "email_logs" ("tenant_id", "module", "action")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_logs_tenant_module_action"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_logs"');
  }
}