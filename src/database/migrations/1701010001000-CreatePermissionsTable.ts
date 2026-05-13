import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePermissionsTable1701010001000 implements MigrationInterface {
  name = 'CreatePermissionsTable1701010001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "permissions"
            (
                "id"          SERIAL       NOT NULL,
                "name"        VARCHAR(100) NOT NULL UNIQUE,
                "description" TEXT,
                "created_at"  TIMESTAMP WITH TIME ZONE DEFAULT now(),
                "updated_at"  TIMESTAMP WITH TIME ZONE DEFAULT now(),
                CONSTRAINT "PK_permissions_id" PRIMARY KEY ("id")
            );
        `);

    await queryRunner.query(`
            CREATE TABLE "role_permissions"
            (
                "role_id"       INTEGER NOT NULL,
                "permission_id" INTEGER NOT NULL,
                CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id"),
                CONSTRAINT "FK_role_permissions_role_id" FOREIGN KEY ("role_id")
                    REFERENCES "roles" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_role_permissions_permission_id" FOREIGN KEY ("permission_id")
                    REFERENCES "permissions" ("id") ON DELETE CASCADE
            );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "role_permissions";`);
    await queryRunner.query(`DROP TABLE "permissions";`);
  }
}
