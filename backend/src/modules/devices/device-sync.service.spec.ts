import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ObjectLiteral } from 'typeorm';
import { DeviceSyncService } from './device-sync.service';
import type { DevicesService } from './devices.service';
import type { ActivityLogService } from '../activity-log/activity-log.service';
import { ProjectEntity, ProjectStatus } from '../projects/entities/project.entity';
import { DeviceEntity } from './entities/device.entity';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T extends ObjectLiteral>() =>
  ({
    findOne: jest.fn(),
    find: jest.fn()
  }) as MockRepository<T>;

describe('DeviceSyncService', () => {
  let devicesService: { registerOrUpdate: jest.Mock };
  let activityLogService: { record: jest.Mock };
  let projectRepository: MockRepository<ProjectEntity>;
  let devicesRepository: MockRepository<DeviceEntity>;
  let service: DeviceSyncService;

  const projectId = 'project-123';

  beforeEach(() => {
    devicesService = {
      registerOrUpdate: jest.fn()
    };
    activityLogService = {
      record: jest.fn()
    };
    projectRepository = createMockRepository<ProjectEntity>();
    devicesRepository = createMockRepository<DeviceEntity>();

    service = new DeviceSyncService(
      devicesService as unknown as DevicesService,
      activityLogService as unknown as ActivityLogService,
      projectRepository as unknown as Repository<ProjectEntity>,
      devicesRepository as unknown as Repository<DeviceEntity>
    );
  });

  it('throws when gateway mac is invalid', async () => {
    await expect(
      service.processSnapshot({
        projectCode: 12,
        gatewayMac: 'invalid-mac',
        gatewayIp: '192.168.0.10',
        scannedAt: '2025-10-18T02:05:32Z',
        devices: []
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns failures when project is not found', async () => {
    projectRepository.findOne?.mockResolvedValue(null);

    const result = await service.processSnapshot({
      projectCode: 9,
      gatewayMac: '00-11-22-33-44-55',
      gatewayIp: '192.168.0.10',
      scannedAt: '2025-10-18T02:05:32Z',
      devices: [
        {
          mac: '00-11-22-33-44-66',
          type: 'Camera',
          name: 'Cam'
        }
      ]
    });

    expect(result.processed).toBe(0);
    expect(result.failed).toEqual([
      {
        mac: '00-11-22-33-44-66',
        reason: 'project not found'
      }
    ]);
    expect(devicesService.registerOrUpdate).not.toHaveBeenCalled();
  });

  it('processes snapshot, forwards metadata, and marks unseen devices offline', async () => {
    const scannedAt = '2025-10-18T02:05:32Z';
    projectRepository.findOne?.mockResolvedValue({
      id: projectId,
      status: ProjectStatus.ACTIVE
    } as ProjectEntity);

    devicesRepository.find?.mockResolvedValue([
      {
        id: 'existing-offline',
        projectId,
        name: '旧摄像机',
        type: 'Camera',
        macAddress: 'AA:BB:CC:11:22:33',
        ipAddress: '10.0.0.20',
        status: 'online',
        hiddenAt: null
      } as DeviceEntity
    ]);

    devicesService.registerOrUpdate
      .mockImplementationOnce(async () => ({
        id: 'new-device',
        projectId,
        name: '塔吊摄像机',
        type: 'Camera',
        status: 'online',
        macAddress: '00:11:22:33:44:66'
      }))
      .mockImplementationOnce(async () => ({
        id: 'existing-offline',
        projectId,
        name: '旧摄像机',
        type: 'Camera',
        status: 'offline',
        macAddress: 'aa:bb:cc:11:22:33'
      }));

    const result = await service.processSnapshot({
      projectCode: 9,
      gatewayMac: '00-11-22-33-44-55',
      gatewayIp: '192.168.0.10',
      scannedAt,
      devices: [
        {
          mac: '00-11-22-33-44-66',
          type: 'camera',
          name: '塔吊摄像机',
          model: 'IPC123',
          ip: '10.0.0.10',
          statuses: ['online', 'signal-weak'],
          latencyMs: 42,
          packetLoss: 0.3,
          metrics: { rssi: -50 }
        }
      ]
    });

    expect(result).toEqual({ processed: 1, failed: [] });

    expect(devicesService.registerOrUpdate).toHaveBeenCalledTimes(2);
    const [callProjectId, registerPayload, context] = devicesService.registerOrUpdate.mock.calls[0];

    expect(callProjectId).toBe(projectId);
    expect(registerPayload.type).toBe('Camera');
    expect(registerPayload.macAddress).toBe('00:11:22:33:44:66');
    expect(registerPayload.status).toBe('online');
    expect(context.source).toBe('sync');
    expect(context.metadataPatch.gatewayMac).toBe('00:11:22:33:44:55');
    expect(context.metadataPatch.gatewayIp).toBe('192.168.0.10');
    expect(context.metadataPatch.extraStatuses).toEqual(['signal-weak']);
    expect(context.metadataPatch.metrics).toMatchObject({ latencyMs: 42, packetLoss: 0.3, rssi: -50 });
    expect(context.metadataPatch.scannedAt).toBe(new Date(scannedAt).toISOString());
    expect(context.lastSeenAt).toBeInstanceOf(Date);

    const [, offlinePayload, offlineContext] = devicesService.registerOrUpdate.mock.calls[1];
    expect(offlinePayload.status).toBe('offline');
    expect(offlineContext.metadataPatch).toEqual({ extraStatuses: [] });

    expect(activityLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'device.sync',
        projectId,
        details: expect.objectContaining({ processed: 1, failed: 0 })
      })
    );
  });

  it('captures bridge role from payload hints', async () => {
    projectRepository.findOne?.mockResolvedValue({
      id: projectId,
      status: ProjectStatus.ACTIVE
    } as ProjectEntity);

    devicesRepository.find?.mockResolvedValue([]);

    devicesService.registerOrUpdate.mockResolvedValue({
      id: 'bridge-device',
      projectId,
      name: '基站网桥',
      type: 'Bridge',
      status: 'online',
      macAddress: '00:11:22:33:44:77'
    });

    await service.processSnapshot({
      projectCode: 18,
      gatewayMac: '00-11-22-33-44-55',
      devices: [
        {
          mac: '00-11-22-33-44-77',
          type: 'Bridge',
          name: '北侧网桥 AP',
          statuses: ['online'],
          bridgeRole: 'AP'
        }
      ]
    });

    expect(devicesService.registerOrUpdate).toHaveBeenCalledTimes(1);
    const [, , context] = devicesService.registerOrUpdate.mock.calls[0];
    expect(context.metadataPatch.bridgeRole).toBe('AP');
  });
});
