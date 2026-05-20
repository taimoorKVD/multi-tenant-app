import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportingCategoryDto {
  @Type(() => Number)
  @IsInt()
  reportingGroupId!: number;

  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  createdBy?: number;

  @IsOptional()
  updatedBy?: number;
}