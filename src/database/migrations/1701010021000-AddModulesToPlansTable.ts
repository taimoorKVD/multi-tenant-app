import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModulesToPlansTable1701010021000 implements MigrationInterface {
  name = 'AddModulesToPlansTable1701010021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
      ADD COLUMN IF NOT EXISTS "modules" JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "plans"
      SET "modules" = '["dashboard","users","roles","jobpositions","locations","items","vendors","reporting-groups","reporting-categories","form-builder","data-collection","mail"]'::jsonb
      WHERE "modules" = '[]'::jsonb OR "modules" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN IF EXISTS "modules"`);
  }
}
