import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional } from 'class-validator';
import { AssignmentType } from '../../../entities/enums';

/** Assign / Report targets from Create Form step 2. */
export class AssignReportTargetsDto {
  @ApiPropertyOptional({
    enum: AssignmentType,
    example: AssignmentType.INDIVIDUAL,
    description:
      'Assign only. Individual = each person must submit. Shared = any one assignee submitting completes the task for everyone.',
  })
  @IsOptional()
  @IsEnum(AssignmentType)
  assignmentType?: AssignmentType;

  @ApiPropertyOptional({ type: [Number], example: [1, 5], description: 'User IDs who should fill out or receive results.' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  users?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [2],
    description:
      'Job position IDs (users with matching position are included). For individual assign, each user gets their own task.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  jobPosition?: number[];
}
