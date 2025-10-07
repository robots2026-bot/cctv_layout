import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLayoutDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsOptional()
  backgroundImageUrl?: string;
}
