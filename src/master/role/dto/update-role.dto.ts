import { IsArray, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString({ message: 'Role name must be a string.' })
  @MaxLength(100, { message: 'Role name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @IsArray({ message: 'Permissions must be an array of numbers.' })
  @IsNumber({}, { each: true, message: 'Each permission must be a valid number.' })
  permissions?: number[];
}
