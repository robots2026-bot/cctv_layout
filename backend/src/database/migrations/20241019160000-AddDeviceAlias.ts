import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceAlias20241019160000 implements MigrationInterface {
  name = 'AddDeviceAlias20241019160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "alias" varchar(120)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "alias"`);
  }
}
