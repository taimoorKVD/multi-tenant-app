import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches } from 'class-validator';
import { AssignmentStatus } from '../../entities/enums';

/** Real assignment statuses plus `today` (due-date day filter for my-work). */
export const ASSIGNMENT_STATUS_QUERY_VALUES = [
  ...Object.values(AssignmentStatus),
  'today',
] as const;

export type AssignmentStatusQuery = (typeof ASSIGNMENT_STATUS_QUERY_VALUES)[number];

export class QueryAssignmentDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({
    enum: ASSIGNMENT_STATUS_QUERY_VALUES,
    description:
      'Filter by assignment status, or `today` to list work due on a calendar day (UTC). ' +
      'When `today` is combined with `date`, `date` selects the day; otherwise today (UTC) is used.',
  })
  @IsOptional()
  @IsIn(ASSIGNMENT_STATUS_QUERY_VALUES)
  status?: AssignmentStatusQuery;

  @ApiPropertyOptional({
    example: '2026-09-15',
    description:
      'Filter by due date (YYYY-MM-DD, UTC day). Works alone or with `status=today`. ' +
      'With a real status (e.g. pending), both status and due date apply.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be a valid YYYY-MM-DD string',
  })
  date?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filter by template ID.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  templateId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by assignee user ID.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeUserId?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'When true, only return assignments for the current user (Today\'s Work).',
  })
  @IsOptional()
  mine?: boolean | string;
}
