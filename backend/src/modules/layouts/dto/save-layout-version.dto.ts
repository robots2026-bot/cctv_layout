import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SaveLayoutVersionDto {
  @IsString()
  @IsNotEmpty()
  layoutId!: string;

  @IsArray()
  elements!: Record<string, unknown>[];

  @IsArray()
  connections!: Record<string, unknown>[];

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
