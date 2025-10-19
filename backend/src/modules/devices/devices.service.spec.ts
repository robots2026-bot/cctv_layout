import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ObjectLiteral } from 'typeorm';
import { DevicesService } from './devices.service';
import { DeviceEntity } from './entities/device.entity';
import { LayoutEntity } from '../layouts/entities/layout.entity';
import { LayoutVersionEntity } from '../layouts/entities/layout-version.entity';
import type { RegisterDeviceDto } from './dto/register-device.dto';
import type { UpdateDeviceDto } from './dto/update-device.dto';
import { RealtimeService } from '../realtime/realtime.service';
import type { ActivityLogService } from '../activity-log/activity-log.service';

type MockRepository<T extends ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T extends ObjectLiteral>() =>
({
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
  });

  describe('updateDevice', () => {
    const baseDevice: DeviceEntity = {
      id: 'device-placed',
      projectId,
      name: 'Placed Cam',
      type: 'Camera',
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

      const payload: UpdateDeviceDto = { name: 'Updated' };

      await expect(service.updateDevice(projectId, baseDevice.id, payload)).rejects.toBeInstanceOf(
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

      const payload: UpdateDeviceDto = { name: 'Updated Name', model: 'M200' };

      const result = await service.updateDevice(projectId, baseDevice.id, payload);

      expect(result.name).toBe('Updated Name');
      expect(devicesRepository.save).toHaveBeenCalled();
      expect(realtimeService.emitDeviceUpdate).toHaveBeenCalled();
      expect(activityLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'device.update',
          projectId
        })
      );
    });
  });

  describe('removeDevice', () => {
    it('throws conflict when trying to remove placed device', async () => {
      const device: DeviceEntity = {
        id: 'device-in-use',
        projectId,
        name: 'Cam',
        type: 'Camera',
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
        type: 'Camera',
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

      await service.removeDevice(projectId, device.id);

      expect(devicesRepository.remove).toHaveBeenCalledWith(device);
      expect(realtimeService.emitDeviceRemoval).toHaveBeenCalledWith(projectId, device.id);
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
        status: 'online'
      };

      const result = await service.registerOrUpdate(projectId, payload);

      expect(result.status).toBe('online');
      expect(devicesRepository.save).toHaveBeenCalled();
    });
  });
});
