import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateActivityLogsTable1701010011000 implements MigrationInterface {
  name = 'CreateActivityLogsTable1701010011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" SERIAL NOT NULL,
        "tenant" character varying(100),
        "user_id" integer,
        "user_email" character varying(255),
        "action" character varying(50),
        "module" character varying(100),
        "entity" character varying(100),
        "entity_id" character varying(100),
        "method" character varying(10) NOT NULL,
        "endpoint" character varying(500) NOT NULL,
        "status_code" integer,
        "status" character varying(20),
        "duration_ms" integer NOT NULL,
        "ip" character varying(100),
        "user_agent" character varying(500),
        "request_id" character varying(100),
        "query" jsonb,
        "body" jsonb,
        "old_data" jsonb,
        "new_data" jsonb,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_activity_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_created_at" ON "activity_logs" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_user_id" ON "activity_logs" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_status_code" ON "activity_logs" ("status_code")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_method_endpoint" ON "activity_logs" ("method", "endpoint")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_tenant" ON "activity_logs" ("tenant")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_module_action" ON "activity_logs" ("module", "action")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_activity_logs_endpoint" ON "activity_logs" ("endpoint")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_endpoint"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_module_action"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_tenant"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_method_endpoint"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_status_code"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_user_id"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_activity_logs_created_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "activity_logs"');
  }
}
