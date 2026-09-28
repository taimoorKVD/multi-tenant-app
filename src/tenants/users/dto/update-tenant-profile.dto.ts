import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTenantProfileDto {
  @ApiPropertyOptional({ example: 'brian', description: 'First name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  first_name?: string;

  @ApiPropertyOptional({ example: 'Smith', description: 'Last name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  last_name?: string;

  /** Alternative to first_name + last_name — full display name. */
  @ApiPropertyOptional({ example: 'brian Smith' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+1 555 0100', description: 'Phone number' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: '+1 555 0100', deprecated: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'Asia/Karachi',
    description:
      'IANA timezone for this workspace (org). Pick from GET /timezones. Empty string clears to UTC default.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
