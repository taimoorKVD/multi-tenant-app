import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateFieldTypeDto {
  @ApiProperty({ example: 'text' })
  @IsString()
  @Length(2, 120)
  name: string;

  @ApiProperty({ example: 'input' })
  @IsString()
  @Length(1, 120)
  rendererType: string;

  @ApiProperty({ example: 'simple-text' })
  @IsString()
  @Length(1, 160)
  componentName: string;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  configSchema?: Record<string, any>;

  @ApiPropertyOptional({ example: 'text_fields' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: 'General Fields' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  supportsOptions?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  supportsValidation?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  supportsConditions?: boolean;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
