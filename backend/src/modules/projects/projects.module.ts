import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectEntity } from './entities/project.entity';
import { LayoutEntity } from '../layouts/entities/layout.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ProjectMemberEntity } from './entities/project-member.entity';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity, LayoutEntity, ProjectMemberEntity]),
    ActivityLogModule,
    RealtimeModule
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService]
})
export class ProjectsModule {}
