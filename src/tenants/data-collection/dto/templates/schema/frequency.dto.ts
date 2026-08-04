import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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

export class FrequencyScheduleDto {
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

export class FrequencyDto {
  @ApiPropertyOptional({ enum: FrequencyType, example: FrequencyType.RECURRING })
  @IsEnum(FrequencyType)
  type!: FrequencyType;

  @ApiPropertyOptional({ example: '2026-07-17' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ type: [Number], example: [2] })
  @IsOptional()
  jobPosition?: number[];

  @ApiPropertyOptional({ type: FrequencyScheduleDto })
  @ValidateIf((o: FrequencyDto) => o.type === FrequencyType.RECURRING)
  @ValidateNested()
  @Type(() => FrequencyScheduleDto)
  schedule?: FrequencyScheduleDto;
}
