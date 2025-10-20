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
import { RenameDeviceDto } from './dto/rename-device.dto';
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
      return devices.filter((device) => !device.hiddenAt);
    }

    return devices.filter((device) => {
      if (device.hiddenAt) {
        return false;
      }
      if (placedDeviceIds.has(device.id)) {
        return false;
      }
      if (device.macAddress && placedDeviceIds.has(device.macAddress.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  async registerOrUpdate(projectId: string, payload: RegisterDeviceDto): Promise<DeviceEntity> {
    const trimmedType = payload.type.trim();
    const normalizedType =
      trimmedType === 'Camera' || trimmedType === 'NVR' || trimmedType === 'Bridge' || trimmedType === 'Switch'
        ? trimmedType
        : trimmedType.charAt(0).toUpperCase() + trimmedType.slice(1).toLowerCase();
    const trimmedIp = payload.ipAddress?.trim();
    const trimmedName = payload.name?.trim();
    const trimmedModel = payload.model?.trim();
    const normalizedMac = payload.macAddress?.trim().toLowerCase() ?? null;

    const sanitizedIp = trimmedIp && trimmedIp.length > 0 ? trimmedIp : null;
    const sanitizedMac = normalizedMac && normalizedMac.length > 0 ? normalizedMac : null;

    const baseName =
      trimmedName && trimmedName.length > 0
        ? trimmedName
        : trimmedModel && trimmedModel.length > 0
          ? `${normalizedType}-${trimmedModel}`
          : sanitizedIp
            ? `${normalizedType}-${sanitizedIp}`
            : `${normalizedType}-${new Date().getTime().toString(36)}`;

    if (normalizedType !== 'Switch' && !sanitizedMac) {
      throw new BadRequestException('非交换机设备必须提供 MAC 地址');
    }

    let existing: DeviceEntity | null = null;
    if (sanitizedMac) {
      existing = await this.devicesRepository.findOne({
        where: {
          projectId,
          macAddress: sanitizedMac
        }
      });
    }
    if (!existing && sanitizedIp) {
      existing = await this.devicesRepository.findOne({
        where: {
          projectId,
          ipAddress: sanitizedIp
        }
      });
    }

    const desiredStatus = payload.status ?? (existing ? existing.status : 'unknown');

    const effectiveName =
      trimmedName && trimmedName.length > 0 ? trimmedName : existing?.name ?? baseName;

    if (existing) {
      const metadata = { ...(existing.metadata ?? {}) } as Record<string, unknown>;
      if (trimmedModel) {
        metadata.model = trimmedModel;
      }
      if (sanitizedMac) {
        existing.macAddress = sanitizedMac;
      }
      existing.hiddenAt = null;
      this.logger.debug(`Updating device ${existing.id} from sync payload`);
      Object.assign(existing, {
        name: effectiveName,
        type: normalizedType,
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

    const created = this.devicesRepository.create({
      projectId,
      name: effectiveName,
      type: normalizedType,
      alias: null,
      macAddress: sanitizedMac,
      ipAddress: sanitizedIp,
      status: desiredStatus,
      lastSeenAt: new Date(),
      hiddenAt: null,
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

    device.hiddenAt = new Date();
    await this.devicesRepository.save(device);
    this.realtimeService.emitDeviceRemoval(projectId, device.id, device.macAddress ?? null);
    await this.activityLogService.record({
      projectId,
      action: 'device.delete',
      details: { deviceId }
    });
  }

  async renameDevice(projectId: string, deviceId: string, payload: RenameDeviceDto): Promise<DeviceEntity> {
    const entity = await this.devicesRepository.findOne({ where: { id: deviceId, projectId } });
    if (!entity) {
      throw new NotFoundException(`Device ${deviceId} not found in project ${projectId}`);
    }

    await this.assertDeviceUnplaced(projectId, deviceId);

    const nextAlias = payload.name.trim();
    entity.alias = nextAlias.length > 0 ? nextAlias : null;

    const saved = await this.devicesRepository.save(entity);
    this.realtimeService.emitDeviceUpdate(saved);
    await this.activityLogService.record({
      projectId,
      action: 'device.update',
      details: { deviceId, alias: saved.alias }
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
        const maybeDeviceMac = element?.['deviceMac'];
        if (typeof maybeDeviceMac === 'string' && maybeDeviceMac) {
          placedDeviceIds.add(maybeDeviceMac.toLowerCase());
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
