import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AssignmentStatus, SubmissionStatus } from '../../entities/enums';

/** UI completion / workflow filters (maps to assignment status). */
export const ASSIGNED_FORMS_STATUS_VALUES = [
  AssignmentStatus.PENDING,
  AssignmentStatus.IN_PROGRESS,
  AssignmentStatus.COMPLETED,
  AssignmentStatus.OVERDUE,
  AssignmentStatus.CANCELLED,
  /** Alias for pending — matches admin "Not Started" label. */
  'not_started',
] as const;

export type AssignedFormsStatusQuery = (typeof ASSIGNED_FORMS_STATUS_VALUES)[number];

/** Submission / response review filters (independent of assignment status). */
export const ASSIGNED_FORMS_RESPONSE_STATUS_VALUES = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.FLAGGED,
  SubmissionStatus.FAILED,
  SubmissionStatus.APPROVED,
] as const;

export type AssignedFormsResponseStatusQuery =
  (typeof ASSIGNED_FORMS_RESPONSE_STATUS_VALUES)[number];

/** Normalize `?id=1&id=2` or `?id=1,2` or a single `?id=1` into number[]. */
function toIdArray(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
  const ids = [
    ...new Set(
      raw
        .map((item) => Number(item))
        .filter((n) => Number.isFinite(n) && Number.isInteger(n)),
    ),
  ];
  return ids.length ? ids : undefined;
}

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

export class QueryAssignedFormsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 5, description: 'Page size (max 100). Default 15.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    example: 'Kitchen',
    description: 'Search by form/template name or assignee name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    example: 12,
    description:
      'Filter by a single assignee user ID. Prefer `userId` for one or more users. ' +
      'Matches any assignee on the row / shared group.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeUserId?: number;

  @ApiPropertyOptional({
    type: [Number],
    example: [4, 8],
    description:
      'Filter by one or more assignee user IDs. Repeat param (`userId=4&userId=8`) or comma-separated. ' +
      'Merged with `assigneeUserId` when both are sent.',
  })
  @IsOptional()
  @Transform(({ value }) => toIdArray(value))
  @IsArray()
  @IsInt({ each: true })
  userId?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [5, 6],
    description:
      'Filter by one or more job position IDs. Repeat param (`jobPositionId=5&jobPositionId=6`) or comma-separated. ' +
      'Matches assignment.jobPositionId or the assignee user’s current job position (including shared peers).',
  })
  @IsOptional()
  @Transform(({ value }) => toIdArray(value))
  @IsArray()
  @IsInt({ each: true })
  jobPositionId?: number[];

  @ApiPropertyOptional({
    enum: ASSIGNED_FORMS_STATUS_VALUES,
    description:
      'Assignment workflow status. `not_started` is an alias for `pending`. ' +
      'Use `overdue` for overdue forms. For review outcomes use `responseStatus`.',
  })
  @IsOptional()
  @IsIn(ASSIGNED_FORMS_STATUS_VALUES)
  status?: AssignedFormsStatusQuery;

  @ApiPropertyOptional({
    enum: ASSIGNED_FORMS_RESPONSE_STATUS_VALUES,
    isArray: true,
    example: ['flagged', 'failed'],
    description:
      'Filter by submission/response review status. Repeat param or comma-separated. ' +
      'Values: submitted | flagged | failed | approved. Independent of assignment `status`.',
  })
  @IsOptional()
  @Transform(({ value }) => toResponseStatusArray(value))
  @IsArray()
  @IsIn(ASSIGNED_FORMS_RESPONSE_STATUS_VALUES, { each: true })
  responseStatus?: AssignedFormsResponseStatusQuery[];

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Due date range start (YYYY-MM-DD, UTC inclusive).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueFrom must be a valid YYYY-MM-DD string',
  })
  dueFrom?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Due date range end (YYYY-MM-DD, UTC inclusive).',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dueTo must be a valid YYYY-MM-DD string',
  })
  dueTo?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'When true, only assignments with a recent submitted submission (default last 7 days).',
  })
  @IsOptional()
  recentSubmissions?: boolean | string;

  @ApiPropertyOptional({
    example: 7,
    description: 'Lookback days for recentSubmissions (1–90). Default 7.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recentDays?: number;
}
