import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddYearlyPricingToPlansTable1701010025000 implements MigrationInterface {
  name = 'AddYearlyPricingToPlansTable1701010025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
      ADD COLUMN IF NOT EXISTS "yearly_price_cents" INTEGER NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "plans"
      ADD COLUMN IF NOT EXISTS "stripe_yearly_price_id" VARCHAR(255)
    `);
    await queryRunner.query(`
      UPDATE "plans"
      SET "yearly_price_cents" = "price_cents" * 12
      WHERE "yearly_price_cents" IS NULL OR "yearly_price_cents" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "plans"
      DROP COLUMN IF EXISTS "stripe_yearly_price_id",
      DROP COLUMN IF EXISTS "yearly_price_cents"
    `);
  }
}
