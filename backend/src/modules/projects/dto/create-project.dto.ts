import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStage } from '../entities/project.entity';
import { IsEnum } from 'class-validator';
import { IsNumber } from 'class-validator';
import { IsUUID } from 'class-validator';

class LocationDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  text?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  code!: number;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  region?: string;

  @ValidateNested()
  @IsOptional()
  @Type(() => LocationDto)
  location?: LocationDto;

  @IsEnum(ProjectStage)
  @IsOptional()
  stage?: ProjectStage;

  @IsDateString()
  @IsOptional()
  plannedOnlineAt?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  includeDefaultMembership?: boolean;

  @IsUUID('4')
  @IsOptional()
  createdBy?: string;
}
