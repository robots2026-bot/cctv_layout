import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { DevicesService } from './devices.service';
import { ProjectDevicesController } from './devices.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { LayoutEntity } from '../layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../layouts/entities/layout-version.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity, LayoutEntity, LayoutVersionEntity]),
    RealtimeModule,
    ActivityLogModule
  ],
  controllers: [ProjectDevicesController],
  providers: [DevicesService],
  exports: [DevicesService]
})
export class DevicesModule {}
