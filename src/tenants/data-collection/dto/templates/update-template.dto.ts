import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { TemplateSchemaDto } from './schema';

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
    type: TemplateSchemaDto,
    description: 'Complete template schema containing assign, report, frequency, and sections.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateSchemaDto)
  schema?: TemplateSchemaDto;

  @ApiPropertyOptional({
    example: false,
    description: 'When true, publish after update (new version + regenerate future assignments).',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
