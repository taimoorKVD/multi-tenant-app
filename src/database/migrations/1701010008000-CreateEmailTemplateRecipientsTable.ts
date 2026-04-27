import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailTemplateRecipientsTable1701010008000 implements MigrationInterface {
  name = 'CreateEmailTemplateRecipientsTable1701010008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "email_template_recipients" (
        "id" SERIAL NOT NULL,
        "template_id" integer NOT NULL,
        "channel" character varying(10) NOT NULL DEFAULT 'to',
        "source_type" character varying(20) NOT NULL DEFAULT 'static',
        "value" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_template_recipients_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_email_template_recipients_template_id"
          FOREIGN KEY ("template_id") REFERENCES "email_templates"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_email_template_recipients_template_channel" ON "email_template_recipients" ("template_id", "channel")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_email_template_recipients_template_channel"');
    await queryRunner.query('DROP TABLE IF EXISTS "email_template_recipients"');
  }
}