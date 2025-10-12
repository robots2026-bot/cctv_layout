import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ProjectStage, ProjectStatus } from '../entities/project.entity';
import { Type } from 'class-transformer';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(255)
  @IsOptional()
  code?: number;

  @IsEnum(ProjectStage)
  @IsOptional()
  stage?: ProjectStage;
}
