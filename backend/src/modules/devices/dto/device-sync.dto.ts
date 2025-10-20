import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsNumber,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class DeviceSyncItemDto {
  @IsString()
  mac!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  statuses?: string[];

  @IsOptional()
  @IsNumber()
  latencyMs?: number;

  @IsOptional()
  @IsNumber()
  packetLoss?: number;

  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  bridgeRole?: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class DeviceSyncRequestDto {
  @IsInt()
  @Min(0)
  @Max(255)
  projectCode!: number;

  @IsString()
  gatewayMac!: string;

  @IsOptional()
  @IsString()
  gatewayIp?: string;

  @IsOptional()
  @IsString()
  scannedAt?: string;

  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => DeviceSyncItemDto)
  devices!: DeviceSyncItemDto[];
}
