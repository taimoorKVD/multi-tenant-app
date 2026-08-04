import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { AssignmentStatus } from '../../entities/enums';

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

  @ApiPropertyOptional({ enum: AssignmentStatus })
  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

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
