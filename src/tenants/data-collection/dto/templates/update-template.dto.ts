import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';
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
    description:
      'Complete template schema (assign, report, frequency, sections). Stored as JSON — field props like `value` are preserved.',
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, publish after update (new version + regenerate future assignments). ' +
      'Assign/frequency schema changes auto-publish unless this is explicitly false.',
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
