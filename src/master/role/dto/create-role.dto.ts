import { IsArray, ArrayNotEmpty, IsNotEmpty, IsNumber, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString({ message: 'Role name must be a string.' })
  @IsNotEmpty({ message: 'Role name is required.' })
  @MaxLength(100, { message: 'Role name must not exceed 100 characters.' })
  name: string;

  @IsArray({ message: 'Permissions must be an array of numbers.' })
  @ArrayNotEmpty({ message: 'At least one permission is required.' })
  @IsNumber({}, { each: true, message: 'Each permission must be a valid number.' })
  permissions: number[];
}
