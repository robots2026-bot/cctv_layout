import { IsIP, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { DeviceStatus } from '../entities/device.entity';

export class RegisterDeviceDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @IsIn(['Camera', 'NVR', 'Bridge', 'Switch'])
  type!: string;

  @ValidateIf((o) => o.type !== 'Switch' || Boolean(o.ipAddress))
  @IsString()
  @IsNotEmpty()
  @IsIP()
  ipAddress?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  model?: string;

  @IsIn(['online', 'offline', 'unknown'])
  @IsOptional()
  status?: DeviceStatus;
}
