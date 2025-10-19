import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DeviceEntity } from './entities/device.entity';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { RealtimeService } from '../realtime/realtime.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { LayoutEntity } from '../layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../layouts/entities/layout-version.entity';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepository: Repository<DeviceEntity>,
    @InjectRepository(LayoutEntity)
    private readonly layoutsRepository: Repository<LayoutEntity>,
    @InjectRepository(LayoutVersionEntity)
    private readonly layoutVersionsRepository: Repository<LayoutVersionEntity>,
    private readonly realtimeService: RealtimeService,
    private readonly activityLogService: ActivityLogService
  ) {}

  async listProjectDevices(projectId: string): Promise<DeviceEntity[]> {
    const devices = await this.devicesRepository.find({ where: { projectId } });
    if (devices.length === 0) {
      return devices;
    }

    const placedDeviceIds = await this.getPlacedDeviceIds(projectId);
    if (placedDeviceIds.size === 0) {
      return devices;
    }

    return devices.filter((device) => !placedDeviceIds.has(device.id));
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
      const metadata = { ...(existing.metadata ?? {}) } as Record<string, unknown>;
      if (trimmedModel) {
        metadata.model = trimmedModel;
      }
      if (trimmedType === 'Bridge') {
        if (payload.bridgeRole) {
          metadata.bridgeRole = payload.bridgeRole.toUpperCase();
        }
      } else {
        delete metadata.bridgeRole;
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

    const metadata: Record<string, unknown> = {};
    if (trimmedModel) {
      metadata.model = trimmedModel;
    }
    if (trimmedType === 'Bridge' && payload.bridgeRole) {
      metadata.bridgeRole = payload.bridgeRole.toUpperCase();
    }
    if (trimmedType !== 'Bridge') {
      delete metadata.bridgeRole;
    }

    const created = this.devicesRepository.create({
      projectId,
      name: effectiveName,
      type: trimmedType,
      ipAddress: sanitizedIp,
      status: desiredStatus,
      lastSeenAt: new Date(),
      metadata: Object.keys(metadata).length > 0 ? metadata : null
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

  async removeDevice(projectId: string, deviceId: string): Promise<void> {
    const device = await this.devicesRepository.findOne({ where: { id: deviceId, projectId } });
    if (!device) {
      return;
    }

    await this.assertDeviceUnplaced(projectId, deviceId);

    await this.devicesRepository.remove(device);
    this.realtimeService.emitDeviceRemoval(projectId, device.id);
    await this.activityLogService.record({
      projectId,
      action: 'device.delete',
      details: { deviceId }
    });
  }

  async updateDevice(projectId: string, deviceId: string, payload: UpdateDeviceDto): Promise<DeviceEntity> {
    const entity = await this.devicesRepository.findOne({ where: { id: deviceId, projectId } });
    if (!entity) {
      throw new NotFoundException(`Device ${deviceId} not found in project ${projectId}`);
    }

    await this.assertDeviceUnplaced(projectId, deviceId);

    const nextType = payload.type?.trim() ?? entity.type;
    const sanitizedIp =
      payload.ipAddress !== undefined ? (payload.ipAddress?.trim() || null) : entity.ipAddress;
    const nextName = payload.name?.trim() ?? entity.name;
    const metadata = { ...(entity.metadata ?? {}) } as Record<string, unknown>;

    if (payload.model !== undefined) {
      if (payload.model && payload.model.trim()) {
        metadata.model = payload.model.trim();
      } else {
        delete metadata.model;
      }
    }

    if (nextType === 'Bridge') {
      const desiredRole = payload.bridgeRole ?? (metadata.bridgeRole as string | undefined);
      if (!desiredRole) {
        throw new BadRequestException('Bridge device requires role AP 或 ST');
      }
      metadata.bridgeRole = desiredRole.toUpperCase();
    } else {
      delete metadata.bridgeRole;
    }

    Object.assign(entity, {
      name: nextName,
      type: nextType,
      ipAddress: sanitizedIp,
      status: payload.status ?? entity.status,
      metadata: Object.keys(metadata).length > 0 ? metadata : null
    });

    const saved = await this.devicesRepository.save(entity);
    this.realtimeService.emitDeviceUpdate(saved);
    await this.activityLogService.record({
      projectId,
      action: 'device.update',
      details: { deviceId, status: saved.status }
    });
    return saved;
  }

  private async getPlacedDeviceIds(projectId: string): Promise<Set<string>> {
    const layouts = await this.layoutsRepository.find({
      select: ['id', 'currentVersionId'],
      where: { projectId }
    });
    const versionIds = layouts
      .map((layout) => layout.currentVersionId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    if (versionIds.length === 0) {
      return new Set<string>();
    }

    const versions = await this.layoutVersionsRepository.find({
      select: ['id', 'elementsJson'],
      where: { id: In(versionIds) }
    });

    const placedDeviceIds = new Set<string>();
    for (const version of versions) {
      if (!Array.isArray(version.elementsJson)) {
        continue;
      }
      for (const element of version.elementsJson as Array<Record<string, unknown>>) {
        const maybeDeviceId = element?.['deviceId'];
        if (typeof maybeDeviceId === 'string' && maybeDeviceId) {
          placedDeviceIds.add(maybeDeviceId);
        }
      }
    }

    return placedDeviceIds;
  }

  private async assertDeviceUnplaced(projectId: string, deviceId: string): Promise<void> {
    const placedDeviceIds = await this.getPlacedDeviceIds(projectId);
    if (placedDeviceIds.has(deviceId)) {
      throw new ConflictException(`Device ${deviceId} is already placed in a layout`);
    }
  }
}
