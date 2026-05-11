import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyResetTokenDto {
  @ApiProperty({
    example: 'admin@kingdomvision.com',
    description: 'Registered tenant account email address.',
  })
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty({ message: 'Email is required.' })
  email: string;

  @ApiProperty({
    example: 'd11b0d6f84bb14d1470f6da0f5ea0de31fa53c53cb8bd0b37c2f67ff7d5a9f66',
    description: 'Password reset token received via email.',
  })
  @IsString({ message: 'Token must be a string.' })
  @IsNotEmpty({ message: 'Token is required.' })
  token: string;
}
