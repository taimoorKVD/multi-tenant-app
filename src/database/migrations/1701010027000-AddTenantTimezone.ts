import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantTimezone1701010027000 implements MigrationInterface {
  name = 'AddTenantTimezone1701010027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "timezone"`);
  }
}
