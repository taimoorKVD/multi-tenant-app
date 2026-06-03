import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional } from 'class-validator';

export class CreateSubmissionDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  versionId?: number;

  @ApiProperty({
    example: { email: 'user@example.com', full_name: 'John Doe' },
    description: 'Submitted field payload keyed by field name.',
  })
  @IsObject()
  submissionData: Record<string, any>;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
