import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class DuplicateTemplateDto {
  @ApiPropertyOptional({
    example: 'Manager Report (Copy)',
    description:
      'Name for the duplicated template. Defaults to original name with " (Copy)" appended.',
  })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
}
