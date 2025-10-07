import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('projects/:projectId/devices')
export class ProjectDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  list(@Param('projectId') projectId: string) {
    return this.devicesService.listProjectDevices(projectId).then((devices) =>
      devices.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        ip: device.ipAddress,
        status: device.status
      }))
    );
  }

  @Post('register')
  register(@Param('projectId') projectId: string, @Body() dto: RegisterDeviceDto) {
    return this.devicesService.registerOrUpdate({ ...dto, projectId });
  }
}
