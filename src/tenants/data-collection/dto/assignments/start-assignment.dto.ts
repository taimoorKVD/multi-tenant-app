import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

/** Optional body when starting / resuming an assignment. */
export class StartAssignmentDto {
  @ApiPropertyOptional({
    example: { fld_001: 'Kitchen looks clean' },
    description:
      'Partial answers to persist as a draft when starting or leaving the form. ' +
      'Returned again on my-work / get assignment so the employee can resume.',
  })
  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;
}
