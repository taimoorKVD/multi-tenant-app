import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SignupHandoffDto {
  @ApiProperty({
    example: 'abc123xyz',
    description: 'One-time login token from GET /api/public/signup/status',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(16)
  @MaxLength(200)
  token!: string;
}
