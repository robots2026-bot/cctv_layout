import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ProjectEntity } from '../modules/projects/entities/project.entity';
import { DeviceEntity } from '../modules/devices/entities/device.entity';
import { LayoutEntity } from '../modules/layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../modules/layouts/entities/layout-version.entity';
import { UserEntity } from '../modules/auth/entities/user.entity';
import { ActivityLogEntity } from '../modules/activity-log/entities/activity-log.entity';
import { ProjectMemberEntity } from '../modules/projects/entities/project-member.entity';
import { ProjectFileEntity } from '../modules/files/entities/project-file.entity';

export default registerAs('database', (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'cctv_layout',
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
  entities: [
    ProjectEntity,
    ProjectMemberEntity,
    DeviceEntity,
    LayoutEntity,
    LayoutVersionEntity,
    UserEntity,
    ActivityLogEntity,
    ProjectFileEntity
  ],
  migrations: ['dist/database/migrations/*.js'],
  migrationsRun: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
}));
