import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTaskTable1795434544509 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task" RENAME TO "tasks"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" RENAME TO "task"`);
  }
}
