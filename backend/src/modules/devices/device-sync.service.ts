import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceEntity, DeviceStatus } from './entities/device.entity';
import { DeviceSyncRequestDto, DeviceSyncItemDto } from './dto/device-sync.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { ProjectEntity, ProjectStatus } from '../projects/entities/project.entity';
import { DevicesService } from './devices.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

export interface DeviceSyncResult {
  processed: number;
  failed: Array<{ mac?: string; reason: string }>;
}

const DEVICE_TYPE_MAP: Record<string, 'Camera' | 'NVR' | 'Bridge' | 'Switch'> = {
  camera: 'Camera',
  nvr: 'NVR',
  bridge: 'Bridge',
  switch: 'Switch'
};

const ALLOWED_DEVICE_STATUSES: DeviceStatus[] = ['online', 'offline', 'warning', 'unknown'];

@Injectable()
export class DeviceSyncService {
  private readonly logger = new Logger(DeviceSyncService.name);

  constructor(
    private readonly devicesService: DevicesService,
    private readonly activityLogService: ActivityLogService,
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
    @InjectRepository(DeviceEntity)
    private readonly devicesRepository: Repository<DeviceEntity>
  ) {}

  async processSnapshot(payload: DeviceSyncRequestDto): Promise<DeviceSyncResult> {
    const normalizedGatewayMac = this.normalizeMac(payload.gatewayMac);
    if (!normalizedGatewayMac) {
      throw new BadRequestException('网关 MAC 地址格式不正确');
    }
    const gatewayIp = this.normalizeIp(payload.gatewayIp);
    const snapshotTime = this.normalizeTimestamp(payload.scannedAt);

    const project = await this.projectRepository.findOne({
      where: {
        code: payload.projectCode,
        status: ProjectStatus.ACTIVE
      }
    });

    if (!project) {
      return {
        processed: 0,
        failed: payload.devices.map((device) => ({
          mac: device.mac,
          reason: 'project not found'
        }))
      };
    }

    const failures: Array<{ mac?: string; reason: string }> = [];
    const seenDeviceIds = new Set<string>();
    const seenDeviceMacs = new Set<string>();
    let processed = 0;

    for (const device of payload.devices) {
      const normalizedMac = this.normalizeMac(device.mac);
      if (!normalizedMac) {
        failures.push({ mac: device.mac, reason: 'mac invalid' });
        continue;
      }
      const normalizedType = this.normalizeType(device.type);
      if (!normalizedType) {
        failures.push({ mac: device.mac, reason: 'type invalid' });
        continue;
      }
      const registerPayload = this.buildRegisterPayload(device, normalizedType, normalizedMac);
      const { primaryStatus, extraStatuses } = this.extractStatuses(device.statuses);
      registerPayload.status = primaryStatus;

      const metadataPatch: Record<string, unknown> = {
        extraStatuses,
        gatewayMac: normalizedGatewayMac
      };
      if (gatewayIp) {
        metadataPatch.gatewayIp = gatewayIp;
      }
      if (snapshotTime) {
        metadataPatch.scannedAt = snapshotTime.toISOString();
      }

      const metrics = this.extractMetrics(device);
      if (metrics) {
        metadataPatch.metrics = metrics;
      }

      const bridgeRole = this.resolveBridgeRole(device, normalizedType);
      if (bridgeRole) {
        metadataPatch.bridgeRole = bridgeRole;
      }

      try {
        const saved = await this.devicesService.registerOrUpdate(project.id, registerPayload, {
          metadataPatch,
          lastSeenAt: snapshotTime ?? new Date(),
          source: 'sync'
        });
        processed += 1;
        seenDeviceIds.add(saved.id);
        if (saved.macAddress) {
          seenDeviceMacs.add(saved.macAddress.toLowerCase());
        }
      } catch (error) {
        const reason =
          error instanceof BadRequestException
            ? error.message
            : error instanceof Error
              ? error.message
              : 'unknown error';
        failures.push({ mac: device.mac, reason });
      }
    }

    await this.markMissingDevicesOffline(project.id, seenDeviceIds, seenDeviceMacs, snapshotTime ?? new Date());

    await this.activityLogService.record({
      projectId: project.id,
      action: 'device.sync',
      details: {
        gatewayMac: normalizedGatewayMac,
        processed,
        failed: failures.length
      }
    });

    return { processed, failed: failures };
  }

  private buildRegisterPayload(
    device: DeviceSyncItemDto,
    normalizedType: 'Camera' | 'NVR' | 'Bridge' | 'Switch',
    mac: string
  ): RegisterDeviceDto {
    const trimmedName = device.name?.trim();
    const trimmedModel = device.model?.trim();
    const trimmedIp = device.ip?.trim();
    return {
      type: normalizedType,
      name: trimmedName && trimmedName.length > 0 ? trimmedName : undefined,
      model: trimmedModel && trimmedModel.length > 0 ? trimmedModel : undefined,
      ipAddress: trimmedIp && trimmedIp.length > 0 ? trimmedIp : undefined,
      macAddress: mac
    } as RegisterDeviceDto;
  }

  private extractMetrics(device: DeviceSyncItemDto): Record<string, unknown> | null {
    const metrics: Record<string, unknown> = {};
    if (typeof device.latencyMs === 'number' && Number.isFinite(device.latencyMs)) {
      metrics.latencyMs = device.latencyMs;
    }
    if (typeof device.packetLoss === 'number' && Number.isFinite(device.packetLoss)) {
      metrics.packetLoss = device.packetLoss;
    }
    if (device.metrics && typeof device.metrics === 'object' && !Array.isArray(device.metrics)) {
      Object.assign(metrics, device.metrics);
    }
    return Object.keys(metrics).length > 0 ? metrics : null;
  }

  private extractStatuses(statuses?: string[]) {
    if (!Array.isArray(statuses) || statuses.length === 0) {
      return { primaryStatus: 'unknown' as DeviceStatus, extraStatuses: [] as string[] };
    }
    const cleaned = statuses
      .map((status) => (typeof status === 'string' ? status.trim() : ''))
      .filter((status) => status.length > 0);

    if (cleaned.length === 0) {
      return { primaryStatus: 'unknown' as DeviceStatus, extraStatuses: [] as string[] };
    }

    const primary = cleaned[0].toLowerCase();
    const normalizedPrimary = ALLOWED_DEVICE_STATUSES.includes(primary as DeviceStatus)
      ? (primary as DeviceStatus)
      : ('unknown' as DeviceStatus);
    const extras = cleaned.slice(1).map((status) => status.toLowerCase());
    return { primaryStatus: normalizedPrimary, extraStatuses: extras };
  }

  private resolveBridgeRole(
    device: DeviceSyncItemDto,
    normalizedType: 'Camera' | 'NVR' | 'Bridge' | 'Switch'
  ): 'AP' | 'ST' | null {
    if (normalizedType !== 'Bridge') {
      return null;
    }
    const candidates: string[] = [];
    const push = (value?: unknown) => {
      if (value === undefined || value === null) {
        return;
      }
      const text = String(value).trim();
      if (text.length === 0) {
        return;
      }
      candidates.push(text);
    };

    push(device.bridgeRole);
    push(device.mode);
    push(device.role);
    push(device.model);
    push(device.name);
    if (Array.isArray(device.statuses)) {
      for (const status of device.statuses) {
        push(status);
      }
    }

    for (const candidate of candidates) {
      const resolved = this.matchBridgeRoleCandidate(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  private matchBridgeRoleCandidate(candidate: string): 'AP' | 'ST' | null {
    const normalized = candidate.toLowerCase();
    const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
    const apTokens = new Set(['ap', 'access', 'accesspoint', 'master']);
    const stTokens = new Set(['st', 'sta', 'station', 'client', 'subscriber', 'slave']);

    for (const token of tokens) {
      if (apTokens.has(token)) {
        return 'AP';
      }
      if (stTokens.has(token)) {
        return 'ST';
      }
    }

    if (/(^|[^a-z])ap($|[^a-z])/.test(normalized) || normalized.includes('apmode') || normalized.includes('ap-')) {
      return 'AP';
    }
    if (
      normalized.includes('station') ||
      normalized.includes(' sta') ||
      normalized.includes('sta-') ||
      normalized.includes('client') ||
      normalized.includes('subscriber')
    ) {
      return 'ST';
    }

    return null;
  }

  private async markMissingDevicesOffline(
    projectId: string,
    seenIds: Set<string>,
    seenMacs: Set<string>,
    snapshotTime: Date
  ) {
    const devices = await this.devicesRepository.find({ where: { projectId } });
    for (const device of devices) {
      const mac = device.macAddress?.toLowerCase() ?? null;
      if (seenIds.has(device.id) || (mac && seenMacs.has(mac))) {
        continue;
      }
      if (device.hiddenAt) {
        continue;
      }
      if (device.status === 'offline') {
        continue;
      }
      const offlinePayload = {
        type: device.type,
        name: device.name,
        ipAddress: device.ipAddress ?? undefined,
        macAddress: device.macAddress ?? undefined,
        status: 'offline' as DeviceStatus
      } as RegisterDeviceDto;
      try {
        await this.devicesService.registerOrUpdate(projectId, offlinePayload, {
          metadataPatch: { extraStatuses: [] },
          lastSeenAt: snapshotTime,
          source: 'sync'
        });
      } catch (error) {
        this.logger.warn(`Failed to mark device offline ${device.id}`, error);
      }
    }
  }

  private normalizeMac(input: string | undefined): string | null {
    if (!input) {
      return null;
    }
    const hex = input.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (hex.length !== 12) {
      return null;
    }
    return hex.match(/.{1,2}/g)?.join(':') ?? null;
  }

  private normalizeType(input: string | undefined) {
    if (!input) {
      return null;
    }
    const normalized = DEVICE_TYPE_MAP[input.trim().toLowerCase()];
    return normalized ?? null;
  }

  private normalizeIp(input: string | undefined): string | undefined {
    if (!input) {
      return undefined;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return undefined;
    }
    const segments = trimmed.split('.');
    if (segments.length !== 4) {
      return undefined;
    }
    const valid = segments.every((part) => {
      if (!/^\d{1,3}$/.test(part)) {
        return false;
      }
      const numeric = Number(part);
      return numeric >= 0 && numeric <= 255;
    });
    return valid ? trimmed : undefined;
  }

  private normalizeTimestamp(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      this.logger.warn(`Invalid scannedAt timestamp received: ${value}`);
      return null;
    }
    return new Date(parsed);
  }
}
