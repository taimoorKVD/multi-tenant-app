import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional } from 'class-validator';

export class AutosaveFormDto {
  @ApiProperty({
    example: { sections: [], fields: [] },
    description: 'Temporary autosave schema payload.',
  })
  @IsObject()
  schema: Record<string, any>;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
