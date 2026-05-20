import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportingGroupDto {
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