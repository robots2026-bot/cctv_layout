import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

class PointDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class ElementSizeDto {
  @IsNumber()
  width!: number;

  @IsNumber()
  height!: number;
}

class SaveLayoutElementDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  deviceId?: string | null;

  @IsOptional()
  @IsString()
  deviceMac?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ValidateNested()
  @Type(() => PointDto)
  position!: PointDto;

  @ValidateNested()
  @Type(() => ElementSizeDto)
  size!: ElementSizeDto;

  @IsOptional()
  selected?: boolean;
}

class SaveLayoutConnectionDto {
  @IsString()
  id!: string;

  @ValidateNested()
  @Type(() => PointDto)
  from!: PointDto;

  @ValidateNested()
  @Type(() => PointDto)
  to!: PointDto;

  @IsIn(['wired', 'wireless'])
  kind!: 'wired' | 'wireless';

  @IsOptional()
  @IsString()
  fromDeviceId?: string | null;

  @IsOptional()
  @IsString()
  toDeviceId?: string | null;

  @IsOptional()
  bandwidth?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  selected?: boolean;
}

export class SaveLayoutVersionDto {
  @IsString()
  @IsNotEmpty()
  layoutId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveLayoutElementDto)
  elements!: SaveLayoutElementDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveLayoutConnectionDto)
  connections!: SaveLayoutConnectionDto[];

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
