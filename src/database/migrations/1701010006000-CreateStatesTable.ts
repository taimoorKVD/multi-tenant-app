import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateStatesTable1701010006000 implements MigrationInterface {
  name = 'CreateStatesTable1701010006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "states"
      (
          "id"         SERIAL       NOT NULL,
          "name"       VARCHAR(120) NOT NULL,
          "country_id" INTEGER      NOT NULL,
          "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          CONSTRAINT "PK_states_id" PRIMARY KEY ("id"),
          CONSTRAINT "FK_states_country_id" FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE,
          CONSTRAINT "UQ_states_country_name" UNIQUE ("country_id", "name")
      );
    `);

    await queryRunner.query(`CREATE INDEX "IDX_states_country_id" ON "states" ("country_id");`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_states_country_id";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "states";`);
  }
}
