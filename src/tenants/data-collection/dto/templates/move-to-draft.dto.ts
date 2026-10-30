import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class MoveToDraftDto {
  @ApiPropertyOptional({ example: 'Daily Kitchen Checklist' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Complete template schema. The schema is saved as JSON without publishing.',
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
