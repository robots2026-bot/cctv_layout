import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  async registerOrUpdate(projectId: string, payload: RegisterDeviceDto): Promise<DeviceEntity> {
    const trimmedType = payload.type.trim();
    const trimmedIp = payload.ipAddress?.trim();
    const trimmedName = payload.name?.trim();
    const trimmedModel = payload.model?.trim();

    const sanitizedIp = trimmedIp && trimmedIp.length > 0 ? trimmedIp : null;

    const baseName =
      trimmedName && trimmedName.length > 0
        ? trimmedName
        : trimmedModel && trimmedModel.length > 0
          ? `${trimmedType}-${trimmedModel}`
          : sanitizedIp
            ? `${trimmedType}-${sanitizedIp}`
            : `${trimmedType}-${new Date().getTime().toString(36)}`;

    let existing: DeviceEntity | null = null;
    if (sanitizedIp) {
      existing = await this.devicesRepository.findOne({
        where: {
          projectId,
          ipAddress: sanitizedIp
        }
      });
    } else {
      existing = await this.devicesRepository.findOne({
        where: {
          projectId,
          type: trimmedType,
          name: baseName
        }
      });
    }

    const desiredStatus = payload.status ?? (existing ? existing.status : 'unknown');

    const effectiveName = existing?.name ?? baseName;

    if (existing) {
      const metadata = { ...(existing.metadata ?? {}) };
      if (trimmedModel) {
        metadata.model = trimmedModel;
      }
      this.logger.debug(`Updating device ${existing.id} from sync payload`);
      Object.assign(existing, {
        name: effectiveName,
        type: trimmedType,
        ipAddress: sanitizedIp,
        status: desiredStatus,
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

    const metadata = trimmedModel
      ? { model: trimmedModel }
      : undefined;

    const created = this.devicesRepository.create({
      projectId,
      name: effectiveName,
      type: trimmedType,
      ipAddress: sanitizedIp,
      status: desiredStatus,
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
