import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PermissionModuleDto {
  @IsString({ message: 'Module name must be a string.' })
  @IsNotEmpty({ message: 'Module name is required.' })
  @MaxLength(100, { message: 'Module name must not exceed 100 characters.' })
  name!: string;
}
