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
      'individual | shared. Assign: each person must submit vs any one completes the group. Report: notify each recipient separately vs one shared notification to the group.',
  })
  @IsOptional()
  @IsEnum(AssignmentType)
  mode?: AssignmentType;

  /** @deprecated Prefer `mode`. Still accepted for older clients. */
  @ApiPropertyOptional({
    enum: AssignmentType,
    deprecated: true,
    description: 'Deprecated alias for `mode`.',
  })
  @IsOptional()
  @IsEnum(AssignmentType)
  assignmentType?: AssignmentType;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [1, 5],
    description:
      'User IDs. Mutually exclusive with jobPosition — send users OR jobPosition, not both.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  users?: number[] | null;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [2],
    description:
      'Job position IDs. Mutually exclusive with users. Expands to every user with that job_position_id.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  jobPosition?: number[] | null;
}
