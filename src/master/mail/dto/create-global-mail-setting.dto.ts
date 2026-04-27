import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateGlobalMailSettingDto {
  @ApiPropertyOptional({ example: 'mailtrap' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  provider?: string;

  @ApiProperty({ example: 'sandbox.smtp.mailtrap.io' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ example: 2525 })
  @IsInt()
  @Min(1)
  port: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  secure: boolean;

  @ApiPropertyOptional({ example: 'smtp-user' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'smtp-password-or-api-key' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ example: 'no-reply@eusocial.com' })
  @IsEmail()
  from_email: string;

  @ApiPropertyOptional({ example: 'EuSocial' })
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional({ example: 'support@eusocial.com' })
  @IsOptional()
  @IsEmail()
  reply_to?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}