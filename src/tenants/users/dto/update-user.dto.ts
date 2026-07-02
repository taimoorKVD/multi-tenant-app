import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address.' })
  email?: string;

  @IsOptional()
  password?: string;

  @IsOptional()
  password_confirm?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Role ID must be numeric.' })
  role_id?: number;
}
