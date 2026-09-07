import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PermissionModuleDto } from './permission-module.dto';

export class CreatePermissionDto {
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PermissionModuleDto)
  module?: PermissionModuleDto;
}
