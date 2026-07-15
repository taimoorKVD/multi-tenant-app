import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional({ example: 'Daily Kitchen Inspection' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Complete template schema containing assign, report, frequency, and sections.',
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
