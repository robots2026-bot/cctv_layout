import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ObjectLiteral } from 'typeorm';
import { DevicesService } from './devices.service';
import { DeviceEntity } from './entities/device.entity';
import { LayoutEntity } from '../layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../layouts/entities/layout-version.entity';
import type { RegisterDeviceDto } from './dto/register-device.dto';
import type { RenameDeviceDto } from './dto/rename-device.dto';
import { RealtimeService } from '../realtime/realtime.service';
import type { ActivityLogService } from '../activity-log/activity-log.service';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T extends ObjectLiteral>() =>
({
  create: jest.fn((entity: Partial<T>) => entity),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  remove: jest.fn()
}) as MockRepository<T>;

describe('DevicesService unplaced device handling', () => {
  let devicesRepository: MockRepository<DeviceEntity>;
  let layoutsRepository: MockRepository<LayoutEntity>;
  let layoutVersionsRepository: MockRepository<LayoutVersionEntity>;
  let realtimeService: RealtimeService;
  let activityLogService: { record: jest.Mock };
  let service: DevicesService;

  const projectId = 'project-1';

  beforeEach(() => {
    jest.clearAllMocks();
    devicesRepository = createMockRepository<DeviceEntity>();
    layoutsRepository = createMockRepository<LayoutEntity>();
    layoutVersionsRepository = createMockRepository<LayoutVersionEntity>();
    realtimeService = new RealtimeService();
    jest.spyOn(realtimeService, 'emitDeviceUpdate').mockImplementation(() => undefined);
    jest.spyOn(realtimeService, 'emitDeviceRemoval').mockImplementation(() => undefined);
    jest.spyOn(realtimeService, 'emitLayoutVersion').mockImplementation(() => undefined);
    jest.spyOn(realtimeService, 'emitProjectsUpdated').mockImplementation(() => undefined);
    activityLogService = { record: jest.fn() };

    service = new DevicesService(
      devicesRepository as unknown as Repository<DeviceEntity>,
      layoutsRepository as unknown as Repository<LayoutEntity>,
      layoutVersionsRepository as unknown as Repository<LayoutVersionEntity>,
      realtimeService,
      activityLogService as unknown as ActivityLogService
    );
  });

  describe('listProjectDevices', () => {
    it('filters out devices that are already placed in any layout version', async () => {
      const devices: DeviceEntity[] = [
        {
          id: 'device-1',
          projectId,
          name: 'Cam A',
          type: 'Camera',
          status: 'online',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as DeviceEntity,
        {
          id: 'device-2',
          projectId,
          name: 'Cam B',
          type: 'Camera',
          status: 'offline',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as DeviceEntity
      ];

      devicesRepository.find?.mockResolvedValue(devices);
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-1' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        {
          id: 'version-1',
          layoutId: 'layout-1',
          elementsJson: [
            { id: 'el-1', deviceId: 'device-2' },
            { id: 'el-2' }
          ]
        }
      ]);

      const result = await service.listProjectDevices(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('device-1');
    });

    it('returns all devices when no placements exist', async () => {
      const devices: DeviceEntity[] = [
        {
          id: 'device-1',
          projectId,
          name: 'Cam A',
          type: 'Camera',
          macAddress: 'aa:bb:cc:00:00:01',
          status: 'online',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as DeviceEntity
      ];

      devicesRepository.find?.mockResolvedValue(devices);
      layoutsRepository.find?.mockResolvedValue([]);

      const result = await service.listProjectDevices(projectId);

      expect(result).toEqual(devices);
    });

    it('filters using device mac addresses', async () => {
      const devices: DeviceEntity[] = [
        {
          id: 'device-1',
          projectId,
          name: 'Cam A',
          type: 'Camera',
          macAddress: 'aa:bb:cc:dd:ee:01',
          status: 'online',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as DeviceEntity,
        {
          id: 'device-2',
          projectId,
          name: 'Cam B',
          type: 'Camera',
          macAddress: 'aa:bb:cc:dd:ee:02',
          status: 'offline',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date()
        } as DeviceEntity
      ];

      devicesRepository.find?.mockResolvedValue(devices);
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-1' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        {
          id: 'version-1',
          layoutId: 'layout-1',
          elementsJson: [
            { id: 'el-1', deviceMac: 'aa:bb:cc:dd:ee:02' }
          ]
        }
      ]);

      const result = await service.listProjectDevices(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].macAddress).toBe('aa:bb:cc:dd:ee:01');
    });
  });

  describe('renameDevice', () => {
    const baseDevice: DeviceEntity = {
      id: 'device-1',
      projectId,
      name: '设备A',
      type: 'Camera',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      status: 'online',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date()
    } as DeviceEntity;

    it('throws conflict when device already placed', async () => {
      devicesRepository.findOne?.mockResolvedValue(baseDevice);
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-2' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        {
          id: 'version-2',
          layoutId: 'layout-1',
          elementsJson: [{ id: 'el-a', deviceId: baseDevice.id }]
        }
      ]);

      const payload: RenameDeviceDto = { name: 'Updated' };

      await expect(service.renameDevice(projectId, baseDevice.id, payload)).rejects.toBeInstanceOf(
        ConflictException
      );
    });

    it('updates device when not placed', async () => {
      devicesRepository.findOne?.mockResolvedValue({ ...baseDevice });
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-3' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        {
          id: 'version-3',
          layoutId: 'layout-1',
          elementsJson: [{ id: 'el-a', deviceId: 'device-other' }]
        }
      ]);
      devicesRepository.save?.mockImplementation(async (entity: DeviceEntity) => ({
        ...entity,
        metadata: entity.metadata,
        updatedAt: new Date()
      }));

      const payload: RenameDeviceDto = { name: 'Updated Name' };

      const result = await service.renameDevice(projectId, baseDevice.id, payload);

      expect(result.alias).toBe('Updated Name');
      expect(result.name).toBe(baseDevice.name);
      expect(devicesRepository.save).toHaveBeenCalled();
      expect(realtimeService.emitDeviceUpdate).toHaveBeenCalled();
      expect(activityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'device.update',
          projectId
        })
      );
    });

    it('allows clearing alias', async () => {
      devicesRepository.findOne?.mockResolvedValue({ ...baseDevice });
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: null }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([]);
      devicesRepository.save?.mockImplementation(async (entity: DeviceEntity) => ({
        ...entity,
        alias: null,
        updatedAt: new Date()
      }));

      const result = await service.renameDevice(projectId, baseDevice.id, { name: '   ' });

      expect(result.alias).toBeNull();
      expect(devicesRepository.save).toHaveBeenCalled();
    });
  });

  describe('removeDevice', () => {
    it('throws conflict when trying to remove placed device', async () => {
      const device: DeviceEntity = {
        id: 'device-in-use',
        projectId,
        name: 'Cam',
        type: 'Switch',
        status: 'online',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as DeviceEntity;

      devicesRepository.findOne?.mockResolvedValue(device);
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-4' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        { id: 'version-4', layoutId: 'layout-1', elementsJson: [{ deviceId: device.id }] }
      ]);

      await expect(service.removeDevice(projectId, device.id)).rejects.toBeInstanceOf(
        ConflictException
      );
      expect(devicesRepository.remove).not.toHaveBeenCalled();
    });

    it('removes device when unplaced', async () => {
      const device: DeviceEntity = {
        id: 'device-unused',
        projectId,
        name: 'Cam',
        type: 'Switch',
        status: 'offline',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as DeviceEntity;

      devicesRepository.findOne?.mockResolvedValue(device);
      layoutsRepository.find?.mockResolvedValue([
        { id: 'layout-1', projectId, currentVersionId: 'version-5' }
      ]);
      layoutVersionsRepository.find?.mockResolvedValue([
        { id: 'version-5', layoutId: 'layout-1', elementsJson: [{ deviceId: 'other' }] }
      ]);

      devicesRepository.save?.mockImplementation(async (entity: DeviceEntity) => ({
        ...entity,
        hiddenAt: entity.hiddenAt ?? new Date(),
        updatedAt: new Date()
      }));

      await service.removeDevice(projectId, device.id);

      expect(devicesRepository.save).toHaveBeenCalled();
      expect(devicesRepository.save).toHaveBeenCalledWith(expect.objectContaining({
        hiddenAt: expect.any(Date)
      }));
      expect(realtimeService.emitDeviceRemoval).toHaveBeenCalledWith(projectId, device.id, device.macAddress ?? null);
      expect(activityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'device.delete',
          projectId,
          details: { deviceId: device.id }
        })
      );
    });
  });

  describe('registerOrUpdate', () => {
    it('allows updates irrespective of placement constraints (sync path)', async () => {
      const baseDevice: DeviceEntity = {
        id: 'device-sync',
        projectId,
        name: 'SyncCam',
        type: 'Camera',
        status: 'offline',
        macAddress: 'aa:bb:cc:dd:ee:ff',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date()
      } as DeviceEntity;

      devicesRepository.findOne?.mockResolvedValue(baseDevice);
      devicesRepository.save?.mockImplementation(async (entity: DeviceEntity) => ({
        ...entity,
        status: entity.status,
        updatedAt: new Date()
      }));

      const payload: RegisterDeviceDto = {
        type: 'Camera',
        model: 'X1',
        ipAddress: '10.0.0.1',
        status: 'online',
        macAddress: 'AA:BB:CC:DD:EE:FF'
      };

      const result = await service.registerOrUpdate(projectId, payload);

      expect(result.status).toBe('online');
      expect(devicesRepository.save).toHaveBeenCalled();
      expect(result.macAddress).toBe('aa:bb:cc:dd:ee:ff');
    });

    it('requires mac address for non switch devices', async () => {
      const payload: RegisterDeviceDto = {
        type: 'Camera',
        model: 'X1',
        ipAddress: '10.0.0.1'
      };

      await expect(service.registerOrUpdate(projectId, payload)).rejects.toThrow(
        '非交换机设备必须提供 MAC 地址'
      );
    });
  });
});
