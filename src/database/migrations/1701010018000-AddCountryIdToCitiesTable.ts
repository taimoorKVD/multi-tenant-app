import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddCountryIdToCitiesTable1701010018000 implements MigrationInterface {
  name = 'AddCountryIdToCitiesTable1701010018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cities" ADD COLUMN "country_id" INTEGER`);

    await queryRunner.query(`
      UPDATE "cities" c
      SET "country_id" = s."country_id"
      FROM "states" s
      WHERE c."state_id" = s."id"
    `);

    await queryRunner.query(`ALTER TABLE "cities" ALTER COLUMN "country_id" SET NOT NULL`);

    await queryRunner.query(`
      ALTER TABLE "cities"
      ADD CONSTRAINT "FK_cities_country_id"
      FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_cities_country_id" ON "cities" ("country_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cities_country_id"`);
    await queryRunner.query(`ALTER TABLE "cities" DROP CONSTRAINT IF EXISTS "FK_cities_country_id"`);
    await queryRunner.query(`ALTER TABLE "cities" DROP COLUMN IF EXISTS "country_id"`);
  }
}
