import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import { AssignmentStatus } from '../../entities/enums';

/** Occurrence filters for the assignment detail drawer. */
export const ASSIGNED_FORM_OCCURRENCE_STATUS_VALUES = [
  AssignmentStatus.PENDING,
  AssignmentStatus.IN_PROGRESS,
  AssignmentStatus.COMPLETED,
  AssignmentStatus.OVERDUE,
  AssignmentStatus.CANCELLED,
  'not_started',
  /** Open work due today or later (pending / in_progress, not overdue). */
  'upcoming',
  'all',
] as const;

export type AssignedFormOccurrenceStatusQuery =
  (typeof ASSIGNED_FORM_OCCURRENCE_STATUS_VALUES)[number];

export class QueryAssignedFormDetailDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({
    example: 31,
    description: 'Occurrence page size (max 100). Default 31 (≈ one month).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    example: '2026-09',
    description:
      'UTC calendar month for occurrence history (YYYY-MM). ' +
      'Default: current UTC month. Ignored when dueFrom/dueTo are set.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be a valid YYYY-MM string',
  })
  month?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Occurrence due-date range start (YYYY-MM-DD, UTC). Overrides month when set with dueTo.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueFrom must be a valid YYYY-MM-DD string',
  })
  dueFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Occurrence due-date range end (YYYY-MM-DD, UTC). Overrides month when set with dueFrom.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueTo must be a valid YYYY-MM-DD string',
  })
  dueTo?: string;

  @ApiPropertyOptional({
    enum: ASSIGNED_FORM_OCCURRENCE_STATUS_VALUES,
    description:
      'Filter occurrences. `upcoming` = pending/in_progress with dueAt ≥ today (UTC). ' +
      '`not_started` aliases pending. Default `all` (excludes cancelled).',
  })
  @IsOptional()
  @IsIn(ASSIGNED_FORM_OCCURRENCE_STATUS_VALUES)
  status?: AssignedFormOccurrenceStatusQuery;
}
