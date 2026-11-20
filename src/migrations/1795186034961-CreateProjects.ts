import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjects1795186034961 implements MigrationInterface {
    name = 'CreateProjects1795186034961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "projects" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "name" TYPE character varying(100)`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "description" TYPE character varying(500)`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "description" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "description" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "name" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "createdAt"`);
    }

}
