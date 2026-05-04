import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendUserCredentialsDto {
  @ApiProperty({
    example: 'owner@company.com',
    description: 'Recipient email address where credentials should be sent.',
  })
  @IsString()
  recipient_email!: string;
}