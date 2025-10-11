import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsEnum, IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ProjectStage, ProjectStatus } from '../entities/project.entity';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(12)
  @Matches(/^[A-Z0-9-]{3,12}$/)
  code?: string;

  @IsEnum(ProjectStage)
  @IsOptional()
  stage?: ProjectStage;
}
