import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh-token',
    description: 'Valid refresh token issued during login or a previous refresh.',
  })
  @IsString({ message: 'Refresh token must be a string.' })
  @IsNotEmpty({ message: 'Refresh token is required.' })
  refresh_token: string;

  @ApiPropertyOptional({
    example: 'kingdomvision',
    description: 'Tenant slug for generic refresh endpoints when no tenant route or header is used.',
  })
  @IsOptional()
  @IsString({ message: 'Tenant slug must be a string.' })
  tenant_slug?: string;
}