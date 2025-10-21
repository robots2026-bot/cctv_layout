import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RenameDeviceDto } from './dto/rename-device.dto';
import { RegisterSwitchDto } from './dto/register-switch.dto';
import { DeviceEntity } from './entities/device.entity';

@Controller('projects/:projectId/devices')
export class ProjectDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  private mapDevice(device: DeviceEntity) {
    const metadata = (device.metadata ?? null) as Record<string, unknown> | null;
    const rawBridgeRole = typeof metadata?.['bridgeRole'] === 'string' ? String(metadata.bridgeRole) : null;
    const normalizedBridgeRole = rawBridgeRole ? rawBridgeRole.trim().toUpperCase() : null;
    const bridgeRole = normalizedBridgeRole === 'AP' || normalizedBridgeRole === 'ST' ? normalizedBridgeRole : 'UNKNOWN';
    return {
      id: device.id,
      name: device.name,
      alias: device.type === 'Switch' ? null : device.alias,
      type: device.type,
      mac: device.macAddress,
      ip: device.ipAddress,
      status: device.status,
      model:
        typeof device.metadata?.model === 'string'
          ? (device.metadata.model as string)
          : undefined,
      metadata,
      bridgeRole
    };
  }

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.devicesService
      .listProjectDevices(projectId)
      .then((devices) => devices.map((device) => this.mapDevice(device)));
  }

  @Post('register-switch')
  registerSwitch(@Param('projectId') projectId: string, @Body() dto: RegisterSwitchDto) {
    return this.devicesService.createSwitch(projectId, dto).then((device) => this.mapDevice(device));
  }

  @Patch(':deviceId')
  update(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: RenameDeviceDto
  ) {
    return this.devicesService.renameDevice(projectId, deviceId, dto).then((device) => this.mapDevice(device));
  }

  @Delete(':deviceId')
  async remove(@Param('projectId') projectId: string, @Param('deviceId') deviceId: string) {
    await this.devicesService.removeDevice(projectId, deviceId);
    return { success: true };
  }
}
