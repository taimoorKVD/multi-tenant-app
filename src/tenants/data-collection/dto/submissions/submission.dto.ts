import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty({
    example: { fld_001: 'Kitchen looks clean', fld_008: 'yes' },
    description: 'Answers keyed by field id from the template version schema.',
  })
  @IsObject()
  answers!: Record<string, any>;

  @ApiPropertyOptional({
    example: true,
    description: 'When false, save as draft without completing the assignment. Default true.',
  })
  @IsOptional()
  submit?: boolean;
}

export class UpdateSubmissionDto {
  @ApiPropertyOptional({ example: { fld_001: 'Updated notes' } })
  @IsOptional()
  @IsObject()
  answers?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  submit?: boolean;
}
