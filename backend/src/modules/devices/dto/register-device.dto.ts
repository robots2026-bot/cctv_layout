import { IsIP, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { DeviceStatus } from '../entities/device.entity';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type!: string;

  @IsIP()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  model?: string;

  @IsIn(['online', 'offline', 'unknown'])
  @IsOptional()
  status?: DeviceStatus;
}
