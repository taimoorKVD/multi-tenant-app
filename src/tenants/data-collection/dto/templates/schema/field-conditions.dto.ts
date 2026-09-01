import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConditionalActionType, ConditionalOperator } from '../../../entities/enums';

export class FieldConditionRuleDto {
  @ApiProperty({
    example: 'fld_handwash_response',
    description: 'Field id whose answer is evaluated.',
  })
  @IsString()
  fieldId!: string;

  @ApiProperty({
    enum: ConditionalOperator,
    example: ConditionalOperator.EQUALS,
  })
  @IsString()
  operator!: ConditionalOperator | string;

  @ApiPropertyOptional({
    example: 'no',
    description: 'Comparison value. Omit for IS_EMPTY.',
  })
  @IsOptional()
  value?: unknown;
}

/** Controls when a field or section is shown, hidden, enabled, or disabled. */
export class FieldConditionsDto {
  @ApiProperty({
    enum: ConditionalActionType,
    example: ConditionalActionType.SHOW,
    description: 'Action applied when rules match.',
  })
  @IsString()
  action!: ConditionalActionType | string;

  @ApiPropertyOptional({
    enum: ['and', 'or'],
    example: 'and',
    description: 'How multiple rules combine. Defaults to and.',
  })
  @IsOptional()
  @IsIn(['and', 'or'])
  logic?: 'and' | 'or';

  @ApiProperty({ type: [FieldConditionRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldConditionRuleDto)
  rules!: FieldConditionRuleDto[];
}
