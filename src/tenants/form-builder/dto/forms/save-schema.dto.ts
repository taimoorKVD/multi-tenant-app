import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional } from 'class-validator';

export class SaveSchemaDto {
  @ApiProperty({
    example: { sections: [], fields: [], conditionalRules: [] },
    description: 'Full builder schema payload owned by frontend.',
  })
  @IsObject()
  schema: Record<string, any>;

  @ApiPropertyOptional({
    example: true,
    description: 'If true, force form status to draft after save. Omit or set false to publish the form on save.',
  })
  @IsOptional()
  @IsBoolean()
  markAsDraft?: boolean = false;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
