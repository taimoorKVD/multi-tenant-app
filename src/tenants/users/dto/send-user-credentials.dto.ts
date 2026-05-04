import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendUserCredentialsDto {
  @ApiProperty({
    example: 'owner@company.com',
    description: 'Recipient email address where credentials should be sent.',
  })
  @IsEmail({}, { message: 'Recipient email must be a valid email address.' })
  recipient_email!: string;

  @ApiPropertyOptional({
    example: 'TempPass123!',
    description:
      'Optional temporary password. If omitted, the system generates one automatically.',
  })
  @IsOptional()
  @IsString({ message: 'Temporary password must be a string.' })
  @MinLength(8, { message: 'Temporary password must be at least 8 characters long.' })
  @MaxLength(64, { message: 'Temporary password must not exceed 64 characters.' })
  temporary_password?: string;

  @ApiPropertyOptional({
    example: 'both',
    enum: ['create', 'update', 'both'],
    description:
      'Email template action to use. Use "both" to send both create and update templates.',
  })
  @IsOptional()
  @IsString({ message: 'Template action must be a string.' })
  @IsIn(['create', 'update', 'both'], {
    message: 'Template action must be one of: create, update, both.',
  })
  template_action?: 'create' | 'update' | 'both';
}