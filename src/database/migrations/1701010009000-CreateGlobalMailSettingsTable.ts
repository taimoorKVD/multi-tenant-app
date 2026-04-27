import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGlobalMailSettingsTable1701010009000 implements MigrationInterface {
  name = 'CreateGlobalMailSettingsTable1701010009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "global_mail_settings" (
        "id" SERIAL NOT NULL,
        "provider" character varying(50),
        "host" character varying(255) NOT NULL,
        "port" integer NOT NULL DEFAULT 587,
        "secure" boolean NOT NULL DEFAULT false,
        "username" character varying(255),
        "encrypted_password" text,
        "from_email" character varying(255) NOT NULL,
        "from_name" character varying(255),
        "reply_to" character varying(255),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_global_mail_settings_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "global_mail_settings"');
  }
}