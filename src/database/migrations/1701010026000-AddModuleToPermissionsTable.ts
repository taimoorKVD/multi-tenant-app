import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModuleToPermissionsTable1701010026000 implements MigrationInterface {
  name = 'AddModuleToPermissionsTable1701010026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "permissions"
      ADD COLUMN IF NOT EXISTS "module" VARCHAR(100)
    `);

    await queryRunner.query(`
      UPDATE "permissions"
      SET "module" = CASE
        WHEN name ~ '(^|-)dc-' THEN 'data-collection'
        WHEN name LIKE '%-form' OR name LIKE '%-form-%' THEN 'form-builder'
        WHEN name LIKE '%-reporting-category' THEN 'reporting-categories'
        WHEN name LIKE '%-reporting- group' THEN 'reporting-groups'
        WHEN name LIKE '%-job-position' THEN 'jobpositions'
        WHEN name LIKE '%-permission' THEN 'roles'
        WHEN name LIKE '%-role' THEN 'roles'
        WHEN name LIKE '%-user' THEN 'users'
        WHEN name LIKE '%-location' THEN 'locations'
        WHEN name LIKE '%-vendor' THEN 'vendors'
        WHEN name LIKE '%-item' THEN 'items'
        WHEN name LIKE '%-plan'
          OR name LIKE '%-subscription'
          OR name LIKE '%-invoice' THEN 'billing'
        WHEN name LIKE '%-tenant' THEN 'tenants'
        WHEN name LIKE '%-mail' OR name LIKE '%email-template%' THEN 'mail'
        ELSE 'general'
      END
      WHERE "module" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "permissions"
      DROP COLUMN IF EXISTS "module"
    `);
  }
}
