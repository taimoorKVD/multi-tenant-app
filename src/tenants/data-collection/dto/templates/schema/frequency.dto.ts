import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  FrequencyType,
  FrequencyUnit,
  MonthlyRuleType,
  WeekdayOrdinal,
} from '../../../entities/enums';

export class MonthlyRuleDto {
  @ApiPropertyOptional({ enum: MonthlyRuleType, example: MonthlyRuleType.DAY_OF_MONTH })
  @IsEnum(MonthlyRuleType)
  type!: MonthlyRuleType;

  @ApiPropertyOptional({
    example: 1,
    description: 'For dayOfMonth: 1-31, or -1 for last day of month.',
  })
  @IsOptional()
  @IsInt()
  @Min(-1)
  @Max(31)
  day?: number;

  @ApiPropertyOptional({ enum: WeekdayOrdinal, example: WeekdayOrdinal.FIRST })
  @IsOptional()
  @IsEnum(WeekdayOrdinal)
  ordinal?: WeekdayOrdinal;

  @ApiPropertyOptional({
    example: 'monday',
    description: 'Weekday (monday…sunday) or month name depending on UI mode.',
  })
  @IsOptional()
  @IsString()
  weekday?: string;

  @ApiPropertyOptional({ example: 'january' })
  @IsOptional()
  @IsString()
  month?: string;
}

/** Nested under `frequency.recurring` when type is `recurring`. */
export class FrequencyRecurringDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  interval!: number;

  @ApiPropertyOptional({ enum: FrequencyUnit, example: FrequencyUnit.MONTH })
  @IsEnum(FrequencyUnit)
  unit!: FrequencyUnit;

  @ApiPropertyOptional({ example: 12, description: 'Occurrence count (Repeat N times).' })
  @IsInt()
  @Min(1)
  repeat!: number;

  @ApiPropertyOptional({ type: MonthlyRuleDto, description: 'On day / On the rule for month/year.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MonthlyRuleDto)
  monthlyRule?: MonthlyRuleDto;
}

/**
 * Frontend Frequency step payload:
 * `{ type: "atOnce", date: "2026-08-21", jobPosition: null, recurring: null }`
 * or recurring with `recurring: { interval, unit, repeat, monthlyRule? }`.
 */
export class FrequencyDto {
  @ApiPropertyOptional({
    enum: FrequencyType,
    example: FrequencyType.AT_ONCE,
    description: '`atOnce` (one-time) or `recurring`. Legacy `one_time` also accepted.',
  })
  @IsEnum(FrequencyType)
  type!: FrequencyType;

  @ApiPropertyOptional({
    example: '2026-08-21',
    description: 'Occurrence / start date from Frequency UI (`date`).',
  })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Job position id(s) or null.',
  })
  @IsOptional()
  @Allow()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return null;
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    const n = Number(value);
    return Number.isFinite(n) ? [n] : null;
  })
  jobPosition?: number[] | number | null;

  @ApiPropertyOptional({
    type: FrequencyRecurringDto,
    nullable: true,
    description: 'Required when type is `recurring`; null for `atOnce`.',
  })
  @IsOptional()
  @ValidateIf((o: FrequencyDto) => o.type === FrequencyType.RECURRING && o.recurring != null)
  @ValidateNested()
  @Type(() => FrequencyRecurringDto)
  recurring?: FrequencyRecurringDto | null;

  /** @deprecated Prefer `date` — still accepted for older clients. */
  @ApiPropertyOptional({ example: '2026-07-17', deprecated: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** @deprecated Prefer `recurring` — still accepted for older clients. */
  @ApiPropertyOptional({ type: FrequencyRecurringDto, deprecated: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => FrequencyRecurringDto)
  schedule?: FrequencyRecurringDto;

  @ApiPropertyOptional({ example: null, nullable: true, deprecated: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  endDate?: string | null;
}

/** @deprecated Alias kept for exports */
export class FrequencyScheduleDto extends FrequencyRecurringDto {}
