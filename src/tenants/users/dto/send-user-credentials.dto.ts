import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SendUserCredentialsDto {
  @ApiProperty({
    example: 'owner@company.com',
    description: 'Recipient email address where credentials should be sent.',
  })
  @IsEmail({}, { message: 'Recipient email must be a valid email address.' })
  recipient_email!: string;
}