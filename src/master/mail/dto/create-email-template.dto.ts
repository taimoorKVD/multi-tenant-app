import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateEmailTemplateDto {
  @ApiProperty({ example: 'Users :: Create Notification' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'users' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  module: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  action: string;

  @ApiPropertyOptional({ example: 'staff' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @ApiPropertyOptional({ example: '{email}' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ example: 'audit@example.com' })
  @IsOptional()
  @IsString()
  cc?: string;

  @ApiPropertyOptional({ example: 'compliance@example.com' })
  @IsOptional()
  @IsString()
  bcc?: string;

  @ApiProperty({ example: 'Welcome {first_name} to EuSocial' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject: string;

  @ApiProperty({ example: '<p>Hello {first_name}</p>' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ example: 'active', enum: ['active', 'inactive'] })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  is_override?: boolean;
}