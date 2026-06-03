import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class LayoutFieldItemDto {
  @ApiProperty({ example: 10 })
  @IsInt()
  fieldId: number;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  @IsInt()
  sectionId?: number | null;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({ example: 6 })
  @IsInt()
  @Min(1)
  @Max(12)
  gridWidthDesktop: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  gridWidthMobile: number;
}

export class UpdateLayoutDto {
  @ApiProperty({ type: [LayoutFieldItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutFieldItemDto)
  fields: LayoutFieldItemDto[];

  @ApiPropertyOptional({ example: { source: 'builder-ui' } })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
