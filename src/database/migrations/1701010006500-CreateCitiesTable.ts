import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateCitiesTable1701010006500 implements MigrationInterface {
  name = 'CreateCitiesTable1701010006500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cities"
      (
          "id"         SERIAL       NOT NULL,
          "name"       VARCHAR(120) NOT NULL,
          "state_id"   INTEGER      NOT NULL,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          CONSTRAINT "PK_cities_id" PRIMARY KEY ("id"),
          CONSTRAINT "FK_cities_state_id" FOREIGN KEY ("state_id") REFERENCES "states" ("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_cities_state_name" UNIQUE ("state_id", "name")
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_cities_state_id" ON "cities" ("state_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cities_state_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cities";`);
  }
}