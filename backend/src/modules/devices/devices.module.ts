import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceEntity } from './entities/device.entity';
import { DevicesService } from './devices.service';
import { ProjectDevicesController } from './devices.controller';
import { RealtimeModule } from '../realtime/realtime.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceEntity]), RealtimeModule, ActivityLogModule],
  controllers: [ProjectDevicesController],
  providers: [DevicesService],
  exports: [DevicesService]
})
export class DevicesModule {}
