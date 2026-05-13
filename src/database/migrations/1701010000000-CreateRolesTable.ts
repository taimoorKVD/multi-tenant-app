import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRolesTable1701010000000 implements MigrationInterface {
  name = 'CreateRolesTable1701010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "roles"
            (
                "id"         SERIAL       NOT NULL,
                "name"       VARCHAR(100) NOT NULL UNIQUE,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                CONSTRAINT "PK_roles_id" PRIMARY KEY ("id")
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "roles";`);
  }
}
