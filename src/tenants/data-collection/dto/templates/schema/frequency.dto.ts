import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString } from 'class-validator';

/**
 * Frontend Frequency step payload (loose validation — stored as JSON, expanded by FrequencyService):
 * `{ type: "atOnce", date: "2026-08-21", jobPosition: null, recurring: null }`
 * or `{ type: "recurring", date: "...", recurring: { ... } }`
 */
export class FrequencyDto {
  @ApiPropertyOptional({ example: 'atOnce' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: '2026-08-21' })
  @IsOptional()
  @Allow()
  date?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @Allow()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (Array.isArray(value)) return value;
    return value;
  })
  jobPosition?: unknown;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Recurring config object from frontend, or null for atOnce.',
  })
  @IsOptional()
  @Allow()
  recurring?: Record<string, any> | null;

  /** @deprecated Prefer `date` */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @Allow()
  startDate?: string | null;

  /** @deprecated Prefer `recurring` */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @Allow()
  schedule?: Record<string, any> | null;

  @ApiPropertyOptional({ nullable: true, deprecated: true })
  @IsOptional()
  @Allow()
  endDate?: string | null;
}

/** Kept for exports / swagger compatibility — no strict validators. */
export class MonthlyRuleDto {
  @IsOptional()
  @Allow()
  type?: string;

  @IsOptional()
  @Allow()
  day?: number;

  @IsOptional()
  @Allow()
  ordinal?: string;

  @IsOptional()
  @Allow()
  weekday?: string;

  @IsOptional()
  @Allow()
  month?: string;
}

export class FrequencyRecurringDto {
  @IsOptional()
  @Allow()
  interval?: number | string;

  @IsOptional()
  @Allow()
  unit?: string;

  @IsOptional()
  @Allow()
  repeat?: number | string;

  @IsOptional()
  @Allow()
  monthlyRule?: MonthlyRuleDto | Record<string, any>;
}

/** @deprecated Alias */
export class FrequencyScheduleDto extends FrequencyRecurringDto {}
