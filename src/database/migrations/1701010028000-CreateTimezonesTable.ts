import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTimezonesTable1701010028000 implements MigrationInterface {
  name = 'CreateTimezonesTable1701010028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "timezones"
      (
          "id"                 SERIAL       NOT NULL,
          "name"               VARCHAR(64)  NOT NULL,
          "label"              VARCHAR(160) NOT NULL,
          "region"             VARCHAR(64),
          "utc_offset_minutes" INTEGER,
          "created_at"         TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updated_at"         TIMESTAMP WITH TIME ZONE DEFAULT now(),
          CONSTRAINT "PK_timezones_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_timezones_name" UNIQUE ("name")
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_timezones_region" ON "timezones" ("region")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_timezones_region"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "timezones"`);
  }
}
