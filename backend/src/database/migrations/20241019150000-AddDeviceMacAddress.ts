import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceMacAddress20241019150000 implements MigrationInterface {
  name = 'AddDeviceMacAddress20241019150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "mac_address" varchar(32)`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_devices_project_mac" ON "devices" ("project_id", "mac_address") WHERE "mac_address" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_devices_project_mac"`);
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "mac_address"`);
  }
}
