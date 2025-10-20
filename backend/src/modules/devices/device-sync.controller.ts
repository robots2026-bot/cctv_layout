import { Body, Controller, Post } from '@nestjs/common';
import { DeviceSyncService } from './device-sync.service';
import { DeviceSyncRequestDto } from './dto/device-sync.dto';

@Controller('device-sync')
export class DeviceSyncController {
  constructor(private readonly deviceSyncService: DeviceSyncService) {}

  @Post()
  async sync(@Body() payload: DeviceSyncRequestDto) {
    return this.deviceSyncService.processSnapshot(payload);
  }
}
