import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateJobPositionsTable1701010003000 implements MigrationInterface {
    name = 'CreateJobPositionsTable1701010003000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "job_positions"
            (
                "id"         SERIAL       NOT NULL,
                "name"       VARCHAR(100) NOT NULL UNIQUE,
                "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now(),
                CONSTRAINT "PK_job_positions_id" PRIMARY KEY ("id")
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "job_positions";`);
    }
}
