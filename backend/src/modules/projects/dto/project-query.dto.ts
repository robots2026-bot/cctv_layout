import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';
import { ProjectStage, ProjectStatus } from '../entities/project.entity';

export class ProjectQueryDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(200)
  pageSize = 20;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  keyword?: string;

  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @IsEnum(ProjectStage)
  @IsOptional()
  stage?: ProjectStage;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  region?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(255)
  codeGte?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(255)
  codeLte?: number;

  @IsString()
  @IsOptional()
  @IsIn(['name', 'updatedAt'])
  orderBy?: 'name' | 'updatedAt';

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
