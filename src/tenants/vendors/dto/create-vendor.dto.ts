import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  vendor_name?: string;

  @IsOptional()
  @IsInt()
  createdBy?: number;

  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
