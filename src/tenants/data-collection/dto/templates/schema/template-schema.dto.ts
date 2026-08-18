import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AssignReportTargetsDto } from './assign-report.dto';
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

  @ApiPropertyOptional({ type: AssignReportTargetsDto, description: 'Who should fill out this form.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssignReportTargetsDto)
  assign?: AssignReportTargetsDto;

  @ApiPropertyOptional({ type: AssignReportTargetsDto, description: 'Who should receive the results.' })
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
}
