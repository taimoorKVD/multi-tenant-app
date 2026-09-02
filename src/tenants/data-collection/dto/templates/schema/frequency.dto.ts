import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString } from 'class-validator';

/**
 * Frontend Frequency step payload (loose validation — stored as JSON, expanded by FrequencyService):
 * `{ type: "atOnce", date: "2026-08-21", jobPosition: null, recurring: null }`
 * or UI recurring:
 * `{ type: "recurring", date: null, recurring: { every: 1, interval: "day", repeatCount: 5, daysOfWeek: [], monthMode: "dayOfMonth", ... } }`
 * or canonical:
 * `{ type: "recurring", date: "...", recurring: { interval: 1, unit: "day", repeat: 5 } }`
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
  /** Canonical interval count, or UI unit string ("day"|"week"|"month"|"year"). */
  @IsOptional()
  @Allow()
  interval?: number | string;

  @IsOptional()
  @Allow()
  unit?: string;

  /** UI: repeat every N (preferred over numeric `interval` when unit is in `interval`). */
  @IsOptional()
  @Allow()
  every?: number | string;

  @IsOptional()
  @Allow()
  repeat?: number | string | boolean;

  /** UI: number of occurrences (maps to `repeat`). */
  @IsOptional()
  @Allow()
  repeatCount?: number | string;

  @IsOptional()
  @Allow()
  daysOfWeek?: Array<string | number>;

  @IsOptional()
  @Allow()
  monthMode?: string;

  @IsOptional()
  @Allow()
  dayOfMonth?: number | string;

  @IsOptional()
  @Allow()
  weekOrder?: string;

  @IsOptional()
  @Allow()
  onTheMonth?: string;

  @IsOptional()
  @Allow()
  yearDay?: number | string;

  @IsOptional()
  @Allow()
  yearMonth?: string;

  @IsOptional()
  @Allow()
  monthlyRule?: MonthlyRuleDto | Record<string, any>;
}

/** @deprecated Alias */
export class FrequencyScheduleDto extends FrequencyRecurringDto {}
