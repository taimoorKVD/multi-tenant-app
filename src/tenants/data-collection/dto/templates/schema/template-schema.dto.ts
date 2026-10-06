import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AssignReportTargetsDto } from './assign-report.dto';
import { ConditionalRuleDto } from './conditional-rules.dto';
import { FrequencyDto } from './frequency.dto';
import { TemplateSectionDto } from './section.dto';

/**
 * Full template schema matching the Create Form wizard:
 * Form Details (sections) → Assign & Report → Frequency.
 */
export class TemplateSchemaDto {
  @ApiPropertyOptional({
    example: 'Form 1',
    description: 'Form display name mirrored inside schema by the frontend.',
  })
  @IsOptional()
  @IsString()
  formName?: string;

  @ApiPropertyOptional({ type: AssignReportTargetsDto, description: 'Who should fill out this form. Supports mode individual|shared.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssignReportTargetsDto)
  assign?: AssignReportTargetsDto;

  @ApiPropertyOptional({ type: AssignReportTargetsDto, description: 'Who should receive the results. Supports mode individual|shared.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssignReportTargetsDto)
  report?: AssignReportTargetsDto;

  @ApiPropertyOptional({ type: FrequencyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FrequencyDto)
  frequency?: FrequencyDto;

  @ApiPropertyOptional({ type: [TemplateSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateSectionDto)
  sections?: TemplateSectionDto[];

  @ApiPropertyOptional({
    type: [ConditionalRuleDto],
    description:
      'Automation rules evaluated against the pinned schema snapshot on final submit. Disabled rules never fire. Operators: equals, notEquals, contains, notContains, startsWith, endsWith, greaterThan, greaterThanOrEqual, lessThan, lessThanOrEqual, isEmpty, isNotEmpty, checked, unchecked. Comparison types: fixed, field, relatedData. Actions: sendNotification (email Report To + Notification tab), purchaseRequest, maintenanceRequest.',
    example: [
      {
        id: 'logic_numeric_or',
        name: 'Cost over budget',
        enabled: true,
        conditions: {
          match: 'any',
          items: [
            {
              id: 'n_gt_fixed',
              fieldId: 'fld_cost',
              operator: 'greaterThan',
              comparison: { type: 'fixed', value: 500 },
            },
          ],
        },
        actions: [{ id: 'a_pr', type: 'purchaseRequest' }],
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConditionalRuleDto)
  conditionalRules?: ConditionalRuleDto[];
}
