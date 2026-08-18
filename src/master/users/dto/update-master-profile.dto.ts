import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Match } from 'src/common/decorators/match.decorator';

export class UpdateMasterProfileDto {
  @ApiPropertyOptional({ example: 'Super', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Admin', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  @ApiPropertyOptional({ example: 'Super Admin', description: 'Full display name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'SecurePass123!' })
  @ValidateIf((o) => o.password && String(o.password).trim() !== '')
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  @Matches(/^[A-Za-z0-9!@#$%^&*()_+=-]+$/, {
    message: 'Password contains invalid characters.',
  })
  password?: string;

  @ApiPropertyOptional({ example: 'SecurePass123!' })
  @ValidateIf((o) => o.password && String(o.password).trim() !== '')
  @IsOptional()
  @IsString({ message: 'Confirm Password must be a string.' })
  @Match('password', { message: 'Passwords do not match.' })
  password_confirm?: string;
}
