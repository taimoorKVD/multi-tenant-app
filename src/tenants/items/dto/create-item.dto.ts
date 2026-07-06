// import { Type } from 'class-transformer';
// import { ArrayUnique, IsArray, IsNumber, MaxLength } from 'class-validator';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsInt()
  createdBy?: number;

  @IsOptional()
  @IsInt()
  updatedBy?: number;

  // @IsString()
  // @MaxLength(100)
  // itemNo!: string;

  // @IsOptional()
  // @IsString()
  // @MaxLength(5000)
  // description?: string;

  // @IsOptional()
  // @IsString()
  // @MaxLength(100)
  // size?: string;

  // @Type(() => Number)
  // @IsNumber({ maxDecimalPlaces: 2 })
  // cost!: number;

  // @IsOptional()
  // @Type(() => Number)
  // @IsNumber({ maxDecimalPlaces: 2 })
  // par?: number;

  // @IsOptional()
  // @Type(() => Number)
  // @IsInt()
  // vendorId?: number;

  // @IsOptional()
  // isActive?: boolean;

  // @IsOptional()
  // @IsArray()
  // @ArrayUnique()
  // @Type(() => Number)
  // @IsInt({ each: true })
  // reportingCategoryIds?: number[];
}
