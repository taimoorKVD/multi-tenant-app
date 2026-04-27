import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class TestTemplateMailDto {
  @ApiProperty({ example: 'users' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ example: 'kingdomvision' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ example: 'staff' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'test@example.com' })
  @IsOptional()
  to?: string | string[];

  @ApiPropertyOptional({ example: 'manager@example.com' })
  @IsOptional()
  cc?: string | string[];

  @ApiPropertyOptional({ example: 'audit@example.com' })
  @IsOptional()
  bcc?: string | string[];

  @ApiProperty({
    example: {
      first_name: 'John',
      email: 'john@example.com',
      user_id: 10,
    },
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'users:create:tenant_1:john@example.com' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}