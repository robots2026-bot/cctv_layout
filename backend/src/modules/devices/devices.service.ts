import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DeviceEntity } from './entities/device.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { RealtimeService } from '../realtime/realtime.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepository: Repository<DeviceEntity>,
    private readonly realtimeService: RealtimeService,
    private readonly activityLogService: ActivityLogService
  ) {}

  async listProjectDevices(projectId: string): Promise<DeviceEntity[]> {
    return this.devicesRepository.find({ where: { projectId } });
  }

  async registerOrUpdate(device: RegisterDeviceDto): Promise<DeviceEntity> {
    const existing = await this.devicesRepository.findOne({
      where: {
        projectId: device.projectId,
        ipAddress: device.ipAddress ? device.ipAddress : IsNull()
      }
    });

    if (existing) {
      const metadata = { ...(existing.metadata ?? {}) };
      if (typeof device.model === 'string' && device.model.trim()) {
        metadata.model = device.model.trim();
      }
      this.logger.debug(`Updating device ${existing.id} from sync payload`);
      Object.assign(existing, {
        name: device.name,
        type: device.type,
        status: device.status ?? existing.status,
        lastSeenAt: new Date(),
        metadata: Object.keys(metadata).length > 0 ? metadata : null
      });
      const updated = await this.devicesRepository.save(existing);
      this.realtimeService.emitDeviceUpdate(updated);
      await this.activityLogService.record({
        projectId: updated.projectId,
        action: 'device.update',
        details: {
          deviceId: updated.id,
          status: updated.status
        }
      });
      return updated;
    }

    const metadata = typeof device.model === 'string' && device.model.trim()
      ? { model: device.model.trim() }
      : undefined;

    const created = this.devicesRepository.create({
      projectId: device.projectId,
      name: device.name,
      type: device.type,
      ipAddress: device.ipAddress,
      status: device.status ?? 'unknown',
      lastSeenAt: new Date(),
      metadata: metadata ?? null
    });
    const saved = await this.devicesRepository.save(created);
    this.realtimeService.emitDeviceUpdate(saved);
    await this.activityLogService.record({
      projectId: saved.projectId,
      action: 'device.create',
      details: { deviceId: saved.id }
    });
    return saved;
  }
}
