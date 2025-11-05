import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1701010002000 implements MigrationInterface {
  name = 'CreateUsersTable1701010002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users"
            (
                "id"         SERIAL       NOT NULL,
                "name"       VARCHAR(100) NOT NULL,
                "email"      VARCHAR(255) NOT NULL UNIQUE,
                "password"   VARCHAR(255) NOT NULL,
                "role_id"    INTEGER,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_users_role_id" FOREIGN KEY ("role_id")
                    REFERENCES "roles" ("id")
                    ON DELETE SET NULL
                    ON UPDATE CASCADE
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users";`);
  }
}
