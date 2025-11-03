import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  @Matches(/^[A-Za-z0-9!@#$%^&*()_+=-]+$/, {
    message: 'Password contains invalid characters.',
  })
  password: string;
}
