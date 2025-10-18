import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectFiles1760801149098 implements MigrationInterface {
  name = 'CreateProjectFiles1760801149098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE "project_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "layout_id" uuid,
        "category" character varying(32) NOT NULL,
        "object_key" text NOT NULL,
        "public_url" text,
        "filename" text NOT NULL,
        "mime_type" text NOT NULL,
        "size_bytes" bigint,
        "width" integer,
        "height" integer,
        "status" text NOT NULL DEFAULT 'pending_upload',
        "etag" text,
        "checksum" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_files_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_project_files_project_id" ON "project_files" ("project_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_project_files_layout_id" ON "project_files" ("layout_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_project_files_status" ON "project_files" ("status")`
    );
    await queryRunner.query(`
      ALTER TABLE "project_files"
      ADD CONSTRAINT "fk_project_files_project"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "project_files"
      ADD CONSTRAINT "fk_project_files_layout"
      FOREIGN KEY ("layout_id") REFERENCES "layouts"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "project_files"
      ADD CONSTRAINT "fk_project_files_user"
      FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project_files" DROP CONSTRAINT "fk_project_files_user"`);
    await queryRunner.query(
      `ALTER TABLE "project_files" DROP CONSTRAINT "fk_project_files_layout"`
    );
    await queryRunner.query(
      `ALTER TABLE "project_files" DROP CONSTRAINT "fk_project_files_project"`
    );
    await queryRunner.query(`DROP INDEX "idx_project_files_status"`);
    await queryRunner.query(`DROP INDEX "idx_project_files_layout_id"`);
    await queryRunner.query(`DROP INDEX "idx_project_files_project_id"`);
    await queryRunner.query(`DROP TABLE "project_files"`);
  }
}
