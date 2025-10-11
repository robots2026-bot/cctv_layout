import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectManagementEnhancements20241014120000 implements MigrationInterface {
  name = 'ProjectManagementEnhancements20241014120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "location" TO "location_text"`);

    await queryRunner.query(`ALTER TABLE "projects" ADD "code" character varying(12)`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "region" character varying(120)`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "location_geo" point`);
    await queryRunner.query(`CREATE TYPE "projects_stage_enum" AS ENUM('planning','construction','completed','archived')`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "stage" "projects_stage_enum" NOT NULL DEFAULT 'planning'`);
    await queryRunner.query(`CREATE TYPE "projects_status_enum" AS ENUM('active','archived','deleted')`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "status" "projects_status_enum" NOT NULL DEFAULT 'active'`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "planned_online_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "description" text`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "layout_count_cache" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "device_count_cache" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "created_by" uuid`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);

    await queryRunner.query(`
      UPDATE "projects"
      SET "code" = CONCAT('PRJ-', SUBSTRING(id::text, 1, 8))
      WHERE "code" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "projects" ALTER COLUMN "code" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "UQ_projects_code" UNIQUE ("code")`);

    await queryRunner.query(`
      UPDATE "projects" p
      SET layout_count_cache = sub.count
      FROM (
        SELECT project_id, COUNT(*)::int AS count
        FROM layouts
        GROUP BY project_id
      ) sub
      WHERE sub.project_id = p.id
    `);

    await queryRunner.query(`
      UPDATE "projects" p
      SET device_count_cache = sub.count
      FROM (
        SELECT project_id, COUNT(*)::int AS count
        FROM devices
        GROUP BY project_id
      ) sub
      WHERE sub.project_id = p.id
    `);

    await queryRunner.query(`CREATE INDEX "idx_projects_status" ON "projects" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_projects_stage" ON "projects" ("stage")`);
    await queryRunner.query(`CREATE INDEX "idx_projects_status_stage" ON "projects" ("status","stage")`);
    await queryRunner.query(`CREATE INDEX "idx_projects_deleted_at" ON "projects" ("deleted_at")`);

    await queryRunner.query(`
      CREATE TABLE "project_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying(16) NOT NULL,
        "invited_at" TIMESTAMP WITH TIME ZONE,
        "has_notifications" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_project_members_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_project_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_project_member" ON "project_members" ("project_id","user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_project_members_project_id" ON "project_members" ("project_id")`);
    await queryRunner.query(`CREATE INDEX "idx_project_members_user_id" ON "project_members" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_project_members_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_project_members_project_id"`);
    await queryRunner.query(`DROP INDEX "uq_project_member"`);
    await queryRunner.query(`DROP TABLE "project_members"`);

    await queryRunner.query(`DROP INDEX "idx_projects_deleted_at"`);
    await queryRunner.query(`DROP INDEX "idx_projects_status_stage"`);
    await queryRunner.query(`DROP INDEX "idx_projects_stage"`);
    await queryRunner.query(`DROP INDEX "idx_projects_status"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "UQ_projects_code"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "created_by"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "device_count_cache"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "layout_count_cache"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "description"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "planned_online_at"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "projects_status_enum"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "stage"`);
    await queryRunner.query(`DROP TYPE "projects_stage_enum"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "location_geo"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "region"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "code"`);

    await queryRunner.query(`ALTER TABLE "projects" RENAME COLUMN "location_text" TO "location"`);
  }
}
