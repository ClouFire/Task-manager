import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjects1795191041414 implements MigrationInterface {
    name = 'CreateProjects1795191041414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt" AT TIME ZONE 'UTC'`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt" AT TIME ZONE 'UTC'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "updatedAt" TYPE timestamp without time zone USING "updatedAt" AT TIME ZONE 'UTC'`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "createdAt" TYPE timestamp without time zone USING "createdAt" AT TIME ZONE 'UTC'`);
    }

}
