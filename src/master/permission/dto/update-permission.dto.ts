import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PermissionModuleDto } from './permission-module.dto';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PermissionModuleDto)
  module?: PermissionModuleDto;
}
