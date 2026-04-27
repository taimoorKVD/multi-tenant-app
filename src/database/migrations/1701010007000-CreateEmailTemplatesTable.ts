import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTemplatesTable1701010007000 implements MigrationInterface {
  name = 'CreateEmailTemplatesTable1701010007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_templates" (
        "id" SERIAL NOT NULL,
        "name" character varying(150) NOT NULL,
        "module" character varying(80) NOT NULL,
        "action" character varying(80) NOT NULL,
        "role" character varying(80),
        "to" text,
        "cc" text,
        "bcc" text,
        "subject" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'active',
        "version" integer NOT NULL DEFAULT 1,
        "priority" integer,
        "tenant_id" character varying(100),
        "is_override" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_templates_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_templates_module_action_role_version" ON "email_templates" ("module", "action", "role", "version")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_templates_module_action_role_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_templates"');
  }
}