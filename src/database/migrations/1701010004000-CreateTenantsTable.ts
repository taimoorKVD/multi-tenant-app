import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTenantsTable1701010004000 implements MigrationInterface {
  name = 'CreateTenantsTable1701010004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "tenants"
            (
                "id"          SERIAL       NOT NULL,
                "name"        VARCHAR(255) NOT NULL UNIQUE,
                "dbName"      VARCHAR(255) NOT NULL UNIQUE,
                "subdomain"   VARCHAR(255) NOT NULL UNIQUE,
                "customDomain" VARCHAR(255),
                "created_at"  TIMESTAMP WITH TIME ZONE DEFAULT now(),
                CONSTRAINT "PK_tenants_id" PRIMARY KEY ("id")
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tenants";`);
  }
}
