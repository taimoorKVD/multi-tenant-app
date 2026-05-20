import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MaxLength(100)
  itemNo!: string;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  size?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  cost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  par?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vendorId?: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  createdBy?: number;

  @IsOptional()
  updatedBy?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  reportingCategoryIds?: number[];
}