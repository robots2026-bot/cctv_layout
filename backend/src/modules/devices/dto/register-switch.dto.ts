import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterSwitchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
