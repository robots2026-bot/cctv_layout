import { IsIn, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { ProjectFileCategory } from '../entities/project-file.entity';

const ALLOWED_CATEGORIES: ProjectFileCategory[] = ['blueprint', 'background', 'export', 'other'];

export class CreatePresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  mimeType!: string;

  @IsInt()
  @IsPositive()
  sizeBytes!: number;

  @IsIn(ALLOWED_CATEGORIES)
  category!: ProjectFileCategory;

  @IsOptional()
  @IsString()
  layoutId?: string;
}
