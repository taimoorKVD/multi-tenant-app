import { IsEmail, IsNotEmpty, IsNumber, IsString, MaxLength, MinLength } from 'class-validator';
import { Match } from '../../../common/decorators/match.decorator';

export class CreateUserDto {
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name: string;

  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  password: string;

  @IsString({ message: 'Confirm Password must be a string.' })
  @IsNotEmpty({ message: 'Confirm Password is required.' })
  @Match('password', { message: 'Passwords do not match.' })
  password_confirm: string;

  @IsNumber({}, { message: 'Role ID must be a number.' })
  @IsNotEmpty({ message: 'Role ID is required.' })
  role_id: number;
}
