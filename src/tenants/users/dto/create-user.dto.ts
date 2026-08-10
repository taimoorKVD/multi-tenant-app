import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Match } from '../../../common/decorators';

export class CreateUserDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  password?: string;

  @IsOptional()
  @IsString({ message: 'Confirm password must be a string.' })
  @Match('password', { message: 'Passwords do not match.' })
  password_confirm?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Role ID must be numeric if provided.' })
  role_id?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Job position ID must be numeric if provided.' })
  job_position_id?: number;
}
