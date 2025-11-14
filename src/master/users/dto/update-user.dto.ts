import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class UpdateUserDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  /**
   * Password validation only if provided.
   */
  @ValidateIf((o) => o.password && o.password.trim() !== '')
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  @Matches(/^[A-Za-z0-9!@#$%^&*()_+=-]+$/, {
    message: 'Password contains invalid characters.',
  })
  password?: string;

  /**
   * Confirm password only validated if password exists.
   */
  @ValidateIf((o) => o.password && o.password.trim() !== '')
  @IsString({ message: 'Confirm Password must be a string.' })
  @Match('password', { message: 'Passwords do not match.' })
  @IsOptional()
  password_confirm?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Role ID must be a number.' })
  role_id?: number;
}
