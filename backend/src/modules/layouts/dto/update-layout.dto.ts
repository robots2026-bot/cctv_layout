import { IsNumber, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

export class UpdateLayoutDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  backgroundOpacity?: number;
}
