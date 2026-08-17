import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantProfileFields1701010022000 implements MigrationInterface {
  name = 'AddTenantProfileFields1701010022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "email" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "phone_country_code" VARCHAR(8),
      ADD COLUMN IF NOT EXISTS "phone_number" VARCHAR(30),
      ADD COLUMN IF NOT EXISTS "industry" VARCHAR(80),
      ADD COLUMN IF NOT EXISTS "description" VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "country_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "state_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "city" VARCHAR(120),
      ADD COLUMN IF NOT EXISTS "address" VARCHAR(200),
      ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(20)
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenants"
        ADD CONSTRAINT "FK_tenants_country_id"
        FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "tenants"
        ADD CONSTRAINT "FK_tenants_state_id"
        FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenants_country_id" ON "tenants" ("country_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenants_state_id" ON "tenants" ("state_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenants_email" ON "tenants" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_email"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_state_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenants_country_id"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "FK_tenants_state_id"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "FK_tenants_country_id"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "postal_code"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "city"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "state_id"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "country_id"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "industry"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "phone_number"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "phone_country_code"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "email"`);
  }
}
