import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteProjectDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;

  @IsBoolean()
  @IsOptional()
  archiveLayouts?: boolean;

  @IsBoolean()
  @IsOptional()
  keepDeviceMappings?: boolean;
}
