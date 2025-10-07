import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LayoutEntity } from './entities/layout.entity';
import { LayoutVersionEntity } from './entities/layout-version.entity';
import { LayoutsService } from './layouts.service';
import { LayoutsController } from './layouts.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([LayoutEntity, LayoutVersionEntity]), ActivityLogModule, RealtimeModule],
  controllers: [LayoutsController],
  providers: [LayoutsService],
  exports: [LayoutsService]
})
export class LayoutsModule {}
