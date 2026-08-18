import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional } from 'class-validator';

/** Assign / Report targets from Create Form step 2. */
export class AssignReportTargetsDto {
  @ApiPropertyOptional({ type: [Number], example: [1, 5], description: 'User IDs who should fill out or receive results.' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  users?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [2],
    description: 'Job position IDs (users with matching position are included).',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  jobPosition?: number[];
}
