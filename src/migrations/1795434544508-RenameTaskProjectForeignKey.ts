import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTaskProjectForeignKey1795434544508 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" RENAME CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" TO "FK_task_project"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task" RENAME CONSTRAINT "FK_task_project" TO "FK_3797a20ef5553ae87af126bc2fe"`,
    );
  }
}
