import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateCountriesTable1701010005000 implements MigrationInterface {
  name = 'CreateCountriesTable1701010005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "countries"
      (
          "id"         SERIAL       NOT NULL,
          "name"       VARCHAR(120) NOT NULL,
          "code"       VARCHAR(10),
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          CONSTRAINT "PK_countries_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_countries_name" UNIQUE ("name"),
          CONSTRAINT "UQ_countries_code" UNIQUE ("code")
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "countries";`);
  }
}
