import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'admin@kingdomvision.com',
    description: 'Registered tenant account email address.',
  })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @ApiProperty({
    example: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
    description: 'Password reset token received via email.',
  })
  @IsString({ message: 'Token must be a string.' })
  @IsNotEmpty({ message: 'Token is required.' })
  token!: string;

  @ApiProperty({
    example: 'NewStrongPassword123!',
    minLength: 6,
    maxLength: 50,
    description: 'New password.',
  })
  @IsString({ message: 'Password must be a string.' })
  @IsNotEmpty({ message: 'Password is required.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters.' })
  password!: string;

  @ApiProperty({
    example: 'NewStrongPassword123!',
    description: 'Must match password.',
  })
  @IsString({ message: 'Confirm password must be a string.' })
  @IsNotEmpty({ message: 'Confirm password is required.' })
  password_confirm!: string;

  @ApiPropertyOptional({
    example: 'kingdomvision',
    description: 'Tenant slug for generic auth endpoints when no tenant route or header is used.',
  })
  @IsOptional()
  @IsString({ message: 'Tenant slug must be a string.' })
  tenant_slug?: string;
}
