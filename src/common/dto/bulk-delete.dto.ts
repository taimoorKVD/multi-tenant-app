import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class BulkDeleteDto {
  @ApiProperty({
    description: 'IDs of records to delete',
    type: [Number],
    example: [1, 2, 3],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];
}
