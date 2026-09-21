import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AssignmentStatus } from '../../entities/enums';

export const ASSIGNED_FORMS_PRIORITY_VALUES = ['high', 'medium', 'low'] as const;
export type AssignedFormsPriority = (typeof ASSIGNED_FORMS_PRIORITY_VALUES)[number];

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
    description: 'Filter by assignee user ID (Assigned To).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeUserId?: number;

  @ApiPropertyOptional({
    enum: ASSIGNED_FORMS_STATUS_VALUES,
    description:
      'Completion / workflow status. `not_started` is an alias for `pending`. ' +
      'Use `overdue` for overdue forms.',
  })
  @IsOptional()
  @IsIn(ASSIGNED_FORMS_STATUS_VALUES)
  status?: AssignedFormsStatusQuery;

  @ApiPropertyOptional({
    enum: ASSIGNED_FORMS_PRIORITY_VALUES,
    description:
      'Priority derived from due date (UTC): high = due today or past, medium = due within 2 days, low = later.',
  })
  @IsOptional()
  @IsIn(ASSIGNED_FORMS_PRIORITY_VALUES)
  priority?: AssignedFormsPriority;

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
