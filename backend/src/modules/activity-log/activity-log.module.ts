import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogEntity } from './entities/activity-log.entity';
import { ActivityLogService } from './activity-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLogEntity])],
  providers: [ActivityLogService],
  exports: [ActivityLogService]
})
export class ActivityLogModule {}
