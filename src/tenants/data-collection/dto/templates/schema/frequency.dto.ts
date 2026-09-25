import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString } from 'class-validator';

/**
 * Frontend Frequency step payload (loose validation — stored as JSON, expanded by FrequencyService):
 * Flat UI (preferred):
 * `{ type: "atOnce", date: "2026-09-26", time: "15:06", times: [], ... }`
 * `{ type: "recurring", startDate: "2026-09-27", endDate: "2026-10-01", every: 2, interval: "day", repeatCount: 2, times: ["01:00","05:00"], ... }`
 * Nested (still accepted):
 * `{ type: "recurring", date: null, recurring: { every: 1, interval: "day", repeatCount: 5, ... } }`
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

  /** At-once due clock time (`HH:mm` 24h or `h:mm AM/PM`). Recurring uses `times` instead. */
  @ApiPropertyOptional({ example: '15:06', nullable: true })
  @IsOptional()
  @Allow()
  time?: string | null;

  /**
   * Multiple due clock times per occurrence day (recurring).
   * Sent for recurring even when `repeatCount` is 1 (e.g. `["09:00"]`) or greater
   * (e.g. `["01:00","05:00"]`). At-once uses singular `time` instead.
   */
  @ApiPropertyOptional({
    example: ['01:00', '05:00'],
    type: [String],
    nullable: true,
  })
  @IsOptional()
  @Allow()
  times?: string[] | null;

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
    description: 'Nested recurring config (legacy). Flat UI fields on this DTO are preferred.',
  })
  @IsOptional()
  @Allow()
  recurring?: Record<string, any> | null;

  /** Recurring series start (YYYY-MM-DD). Also accepted as legacy alias for `date`. */
  @ApiPropertyOptional({ example: '2026-09-27', nullable: true })
  @IsOptional()
  @Allow()
  startDate?: string | null;

  /** Recurring series end (YYYY-MM-DD). When set, occurrences stop on/before this day. */
  @ApiPropertyOptional({ example: '2026-10-01', nullable: true })
  @IsOptional()
  @Allow()
  endDate?: string | null;

  /** @deprecated Prefer flat fields or `recurring` */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @Allow()
  schedule?: Record<string, any> | null;

  // --- Flat UI recurring fields (also accepted nested under `recurring`) ---

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Allow()
  every?: number | string;

  @ApiPropertyOptional({ example: 'day' })
  @IsOptional()
  @Allow()
  interval?: number | string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Allow()
  repeatCount?: number | string;

  @ApiPropertyOptional({ example: 'dayOfMonth' })
  @IsOptional()
  @Allow()
  monthMode?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Allow()
  dayOfMonth?: number | string;

  @ApiPropertyOptional({ example: 'first' })
  @IsOptional()
  @Allow()
  weekOrder?: string;

  @ApiPropertyOptional({ example: 'january' })
  @IsOptional()
  @Allow()
  onTheMonth?: string;

  @ApiPropertyOptional({ example: [], type: [String] })
  @IsOptional()
  @Allow()
  daysOfWeek?: Array<string | number>;

  @ApiPropertyOptional({ example: 'january' })
  @IsOptional()
  @Allow()
  yearMonth?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Allow()
  yearDay?: number | string;
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

  /**
   * UI: number of occurrences (maps to `repeat`).
   * `1` (Frequency card default) is treated as open-ended for the next 12 months —
   * use type `atOnce` for a single due date, or set `repeatCount` ≥ 2 for a finite series.
   */
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
