import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RestoreProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
