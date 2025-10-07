import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from './entities/activity-log.entity';

interface CreateLogInput {
  projectId: string;
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly activityLogRepository: Repository<ActivityLogEntity>
  ) {}

  async record(input: CreateLogInput) {
    const log = this.activityLogRepository.create({
      projectId: input.projectId,
      userId: input.userId,
      action: input.action,
      details: input.details ?? null
    });
    return this.activityLogRepository.save(log);
  }
}
