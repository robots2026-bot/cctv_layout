import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectCommunicationIdNumeric20241014124500 implements MigrationInterface {
  name = 'ProjectCommunicationIdNumeric20241014124500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE total INTEGER;
      BEGIN
        SELECT COUNT(*) INTO total FROM projects;
        IF total > 256 THEN
          RAISE EXCEPTION '项目数量 % 超过 256，无法自动分配通信 ID，请先清理数据。', total;
        END IF;
      END$$;
    `);

    await queryRunner.query(`ALTER TABLE "projects" ADD "new_code" smallint`);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS rn
        FROM projects
      )
      UPDATE projects AS p
      SET new_code = ranked.rn
      FROM ranked
      WHERE ranked.id = p.id;
    `);

    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "new_code" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "UQ_projects_code"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "code"`);
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "new_code" TO "code"`);
    await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "UQ_projects_code" UNIQUE ("code")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "UQ_projects_code"`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "old_code" character varying(12)`);
    await queryRunner.query(`
      UPDATE "projects"
      SET "old_code" = CONCAT('PRJ-', LPAD(code::text, 3, '0'))
    `);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "old_code" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "UQ_projects_code" UNIQUE ("old_code")`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "code"`);
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "old_code" TO "code"`);
  }
}
