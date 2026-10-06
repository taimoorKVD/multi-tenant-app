import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  WorkflowActionType,
  WorkflowComparisonType,
  WorkflowConditionOperator,
  WorkflowMatchMode,
} from '../../../entities/enums';

export class WorkflowComparisonDto {
  @ApiProperty({ enum: WorkflowComparisonType, example: WorkflowComparisonType.FIXED })
  @IsEnum(WorkflowComparisonType)
  type!: WorkflowComparisonType;

  @ApiPropertyOptional({
    example: 'urgent',
    description: 'Literal value for type=fixed (string, number, or date/time — e.g. 500, 2026-10-15, 08:00).',
  })
  @IsOptional()
  value?: unknown;

  @ApiPropertyOptional({
    example: 'fld_title',
    description: 'Answer field id when type=field.',
  })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({
    example: 'fld_vendor',
    description: 'Form field holding the related vendor/item id when type=relatedData.',
  })
  @IsOptional()
  @IsString()
  sourceFieldId?: string;

  @ApiPropertyOptional({
    example: 'fld_vendor_name',
    description: 'Related-module field id or system key to read when type=relatedData.',
  })
  @IsOptional()
  @IsString()
  property?: string;
}

export class WorkflowConditionItemDto {
  @ApiProperty({ example: 't_eq_fixed' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'fld_notes' })
  @IsString()
  fieldId!: string;

  @ApiProperty({ enum: WorkflowConditionOperator, example: WorkflowConditionOperator.EQUALS })
  @IsEnum(WorkflowConditionOperator)
  operator!: WorkflowConditionOperator;

  @ApiProperty({ type: WorkflowComparisonDto })
  @ValidateNested()
  @Type(() => WorkflowComparisonDto)
  comparison!: WorkflowComparisonDto;
}

export class WorkflowConditionsDto {
  @ApiProperty({ enum: WorkflowMatchMode, example: WorkflowMatchMode.ALL })
  @IsIn([WorkflowMatchMode.ALL, WorkflowMatchMode.ANY])
  match!: WorkflowMatchMode;

  @ApiProperty({ type: [WorkflowConditionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConditionItemDto)
  items!: WorkflowConditionItemDto[];
}

export class WorkflowRuleActionDto {
  @ApiProperty({ example: 'a_notify_text' })
  @IsString()
  id!: string;

  @ApiProperty({
    enum: WorkflowActionType,
    example: WorkflowActionType.SEND_NOTIFICATION,
  })
  @IsEnum(WorkflowActionType)
  type!: WorkflowActionType;
}

export class ConditionalRuleDto {
  @ApiProperty({ example: 'logic_text_all_compare_types' })
  @IsString()
  id!: string;

  @ApiProperty({ example: 'Text operators × Fixed / Field / Related Data' })
  @IsString()
  name!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ type: WorkflowConditionsDto })
  @ValidateNested()
  @Type(() => WorkflowConditionsDto)
  conditions!: WorkflowConditionsDto;

  @ApiProperty({ type: [WorkflowRuleActionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowRuleActionDto)
  actions!: WorkflowRuleActionDto[];
}
