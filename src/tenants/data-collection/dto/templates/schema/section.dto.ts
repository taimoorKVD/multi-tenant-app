import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { SectionType } from '../../../entities/enums';

export class FieldOptionDto {
  @ApiProperty({ example: 'Current Quantity' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 'current_quantity' })
  @IsString()
  value!: string;
}

export class FieldOptionSourceDto {
  @ApiPropertyOptional({ example: 'dynamic' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'GET' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ example: 'items' })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  response?: Record<string, any>;
}

/** Individual data point / field inside a section row. */
export class TemplateFieldDto {
  @ApiProperty({ example: 'fld_001' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'Description' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 'description' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'textarea',
    description: 'text | textarea | number | select | checkbox | image | yesNo | etc.',
  })
  @IsString()
  type!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: '100%' })
  @IsOptional()
  @IsString()
  width?: string;

  @ApiPropertyOptional({ type: [FieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOptionDto)
  options?: FieldOptionDto[];

  @ApiPropertyOptional({ type: FieldOptionSourceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldOptionSourceDto)
  optionSource?: FieldOptionSourceDto;
}

export class TemplateRowDto {
  @ApiProperty({ example: 'row_001' })
  @IsString()
  id!: string;

  @ApiProperty({ type: [TemplateFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields!: TemplateFieldDto[];
}

/**
 * Section types from Form Details "Add a Section":
 * - responseForm — open-ended fields
 * - dataEntry — numeric / inventory-style grid
 * - checklist — yes/no style
 * - visual — rich text / media upload
 */
export class TemplateSectionDto {
  @ApiProperty({ example: 'sec_001' })
  @IsString()
  id!: string;

  @ApiProperty({ enum: SectionType, example: SectionType.RESPONSE_FORM })
  @IsEnum(SectionType)
  type!: SectionType;

  @ApiPropertyOptional({ example: 'Response Form' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiProperty({ type: [TemplateRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateRowDto)
  rows!: TemplateRowDto[];
}
