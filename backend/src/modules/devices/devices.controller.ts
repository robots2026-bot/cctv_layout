import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceEntity } from './entities/device.entity';

@Controller('projects/:projectId/devices')
export class ProjectDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  private mapDevice(device: DeviceEntity) {
    const metadataRole =
      typeof device.metadata?.bridgeRole === 'string'
        ? (device.metadata.bridgeRole as string).toUpperCase()
        : undefined;
    return {
      id: device.id,
      name: device.name,
      type: device.type,
      ip: device.ipAddress,
      status: device.status,
      model:
        typeof device.metadata?.model === 'string'
          ? (device.metadata.model as string)
          : undefined,
      bridgeRole:
        metadataRole === 'AP' || metadataRole === 'ST' ? metadataRole : undefined
    };
  }

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.devicesService
      .listProjectDevices(projectId)
      .then((devices) => devices.map((device) => this.mapDevice(device)));
  }

  @Post('register')
  register(@Param('projectId') projectId: string, @Body() dto: RegisterDeviceDto) {
    return this.devicesService
      .registerOrUpdate(projectId, dto)
      .then((device) => this.mapDevice(device));
  }

  @Patch(':deviceId')
  update(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto
  ) {
    return this.devicesService.updateDevice(projectId, deviceId, dto).then((device) => this.mapDevice(device));
  }

  @Delete(':deviceId')
  async remove(@Param('projectId') projectId: string, @Param('deviceId') deviceId: string) {
    await this.devicesService.removeDevice(projectId, deviceId);
    return { success: true };
  }
}
