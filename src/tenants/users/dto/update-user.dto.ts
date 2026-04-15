import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Match } from '../../../common/decorators';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address.' })
  email?: string;

  @IsOptional()
  @IsString({ message: 'Phone number must be a string.' })
  @MaxLength(30, { message: 'Phone number must not exceed 30 characters.' })
  phone_number?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string.' })
  @MaxLength(255, { message: 'Address must not exceed 255 characters.' })
  address?: string;

  @IsOptional()
  @IsString({ message: 'Username must be a string.' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters.' })
  username?: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  password?: string;

  @ValidateIf((o) => !!o.password)
  @IsString({ message: 'Confirm password must be a string.' })
  @Match('password', { message: 'Passwords do not match.' })
  @IsOptional()
  password_confirm?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Role ID must be numeric.' })
  role_id?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Job position ID must be numeric.' })
  job_position_id?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Location ID must be numeric.' })
  location_id?: number;

  @IsOptional()
  @IsArray({ message: 'Availability days must be an array.' })
  @IsString({ each: true, message: 'Each availability day must be a string.' })
  availability_days?: string[];
}
