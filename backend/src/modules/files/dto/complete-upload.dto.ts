import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CompleteUploadDto {
  @IsInt()
  @IsPositive()
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  etag?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;
}
