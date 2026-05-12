import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'admin@kingdomvision.com',
    description: 'Registered tenant account email address.',
  })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email!: string;

  @ApiPropertyOptional({
    example: 'kingdomvision',
    description: 'Tenant slug for generic auth endpoints when no tenant route or header is used.',
  })
  @IsOptional()
  @IsString({ message: 'Tenant slug must be a string.' })
  tenant_slug?: string;
}
