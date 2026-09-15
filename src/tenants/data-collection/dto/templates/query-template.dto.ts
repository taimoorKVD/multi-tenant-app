import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TemplateStatus } from '../../entities/enums';

export class QueryTemplateDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: TemplateStatus,
    description:
      'Filter by status. Omit to list non-archived templates. Use `archived` to list deleted/archived forms for restore.',
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;
}
