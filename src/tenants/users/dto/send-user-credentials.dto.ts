import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendUserCredentialsDto {
  @ApiProperty({
    example: 'owner@company.com',
    description: 'Recipient email address where credentials should be sent.',
  })
  @IsString()
  recipient_email!: string;

  @ApiPropertyOptional({
    example: 'MyP@ssword123',
    description: 'Plaintext password to include in the credentials email.',
  })
  @IsOptional()
  @IsString()
  password?: string;
}