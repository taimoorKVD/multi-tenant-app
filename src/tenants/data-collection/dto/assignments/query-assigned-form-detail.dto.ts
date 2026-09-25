import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import { AssignmentStatus, SubmissionStatus } from '../../entities/enums';
import {
  ASSIGNED_FORMS_RESPONSE_STATUS_VALUES,
  AssignedFormsResponseStatusQuery,
} from './query-assigned-forms.dto';

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

function toResponseStatusArray(value: unknown): SubmissionStatus[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
  const allowed = new Set<string>(ASSIGNED_FORMS_RESPONSE_STATUS_VALUES);
  const statuses = [
    ...new Set(
      raw
        .map((item) => String(item).toLowerCase())
        .filter((item) => allowed.has(item)),
    ),
  ] as SubmissionStatus[];
  return statuses.length ? statuses : undefined;
}

export class QueryAssignedFormDetailDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Occurrence page size (max 100). Default 31.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    example: '2026-09',
    description:
      'UTC calendar month for occurrence history (YYYY-MM). ' +
      'When omitted (and no date/dueFrom/dueTo), default is the next 1 upcoming occurrence only. ' +
      'Pass `month` explicitly for a full calendar month, or `status=upcoming` for all upcoming (paginated).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'month must be a valid YYYY-MM string',
  })
  month?: string;

  @ApiPropertyOptional({
    example: '2026-09-17',
    description:
      'Filter to a single due date (YYYY-MM-DD, UTC). Overrides month. ' +
      'Takes precedence over dueFrom/dueTo when set.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be a valid YYYY-MM-DD string',
  })
  date?: string;

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
      'Filter by assignment occurrence status. `upcoming` = pending/in_progress with dueAt ≥ today (UTC); ' +
      'lists all upcoming with pagination (not limited to one). ' +
      'Default with no range/`status` = next 1 upcoming only. ' +
      'For review outcomes use `responseStatus`.',
  })
  @IsOptional()
  @IsIn(ASSIGNED_FORM_OCCURRENCE_STATUS_VALUES)
  status?: AssignedFormOccurrenceStatusQuery;

  @ApiPropertyOptional({
    enum: ASSIGNED_FORMS_RESPONSE_STATUS_VALUES,
    isArray: true,
    example: ['flagged', 'failed'],
    description:
      'Filter occurrences by submission/response review status. ' +
      'Repeat param or comma-separated: submitted | flagged | failed | approved.',
  })
  @IsOptional()
  @Transform(({ value }) => toResponseStatusArray(value))
  @IsArray()
  @IsIn(ASSIGNED_FORMS_RESPONSE_STATUS_VALUES, { each: true })
  responseStatus?: AssignedFormsResponseStatusQuery[];
}
