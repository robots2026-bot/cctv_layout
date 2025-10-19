import {
  IsIP,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from 'class-validator';
import { DeviceStatus } from '../entities/device.entity';

export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(60)
  @IsIn(['Camera', 'NVR', 'Bridge', 'Switch'])
  type?: string;

  @ValidateIf((payload) => payload.ipAddress !== undefined)
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

  @ValidateIf(
    (payload) => payload.bridgeRole !== undefined || payload.type === 'Bridge'
  )
  @IsString()
  @IsIn(['AP', 'ST'])
  bridgeRole?: 'AP' | 'ST';
}
