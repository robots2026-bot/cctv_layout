import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeviceHiddenAt20241019153000 implements MigrationInterface {
  name = 'AddDeviceHiddenAt20241019153000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "hidden_at" timestamptz`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "devices" DROP COLUMN IF EXISTS "hidden_at"`);
  }
}
