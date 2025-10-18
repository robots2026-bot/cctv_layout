import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DevicesModule } from './modules/devices/devices.module';
import { LayoutsModule } from './modules/layouts/layouts.module';
import { FilesModule } from './modules/files/files.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AuthModule } from './modules/auth/auth.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';
import objectStorageConfig from './config/object-storage.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, objectStorageConfig]
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) =>
        configService.getOrThrow('database') as ReturnType<typeof databaseConfig>,
      inject: [ConfigService]
    }),
    HealthModule,
    ProjectsModule,
    DevicesModule,
    LayoutsModule,
    FilesModule,
    RealtimeModule,
    AuthModule,
    ActivityLogModule
  ]
})
export class AppModule {}
