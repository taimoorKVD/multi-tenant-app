import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateJobPositionDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters.' })
  description?: string;
}
