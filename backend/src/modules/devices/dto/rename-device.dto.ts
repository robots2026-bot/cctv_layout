import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RenameDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
