import {
  Allow,
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldConditionsDto } from './field-conditions.dto';

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
  @ApiPropertyOptional({
    example: 'fld_001',
    description: 'Optional field id from the form builder. Frontend may omit it.',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Description' })
  @IsString()
  label!: string;

  @ApiProperty({ example: 'description' })
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'textarea',
    description: 'text | textarea | number | select | checkbox | image | yesNo | email | etc.',
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

  @ApiPropertyOptional({
    example: 'Omais',
    description:
      'Default / current field value from the form builder (string, number, boolean, array, or object).',
  })
  @IsOptional()
  @Allow()
  value?: unknown;

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

  @ApiPropertyOptional({
    type: FieldConditionsDto,
    description: 'Conditional visibility/enable rules evaluated against other field answers.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldConditionsDto)
  conditions?: FieldConditionsDto;
}

export class TemplateRowDto {
  @ApiPropertyOptional({ example: 'row_001' })
  @IsOptional()
  @IsString()
  id?: string;

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
 * Frontend may send other type strings; enum is not enforced.
 */
export class TemplateSectionDto {
  @ApiProperty({ example: 'sec_001' })
  @IsString()
  id!: string;

  @ApiProperty({
    example: 'responseForm',
    description: 'Section type string from frontend (e.g. responseForm, dataEntry, checklist, visual, custom).',
  })
  @IsString()
  type!: string;

  @ApiPropertyOptional({
    example: 'Data Entry',
    description: 'Section display name from frontend (`name`).',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** @deprecated Prefer `name` — kept for older clients. */
  @ApiPropertyOptional({ example: 'Response Form', deprecated: true })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional({
    type: FieldConditionsDto,
    description: 'Optional section-level conditional visibility.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => FieldConditionsDto)
  conditions?: FieldConditionsDto;

  @ApiProperty({ type: [TemplateRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateRowDto)
  rows!: TemplateRowDto[];
}
