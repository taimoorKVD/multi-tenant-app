import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator';

export class AssignReportingCategoryItemsDto {
  @ApiProperty({
    description: 'Existing item IDs to assign to (or remove from) this reporting category',
    type: [Number],
    example: [1, 2, 3],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  itemIds!: number[];
}
