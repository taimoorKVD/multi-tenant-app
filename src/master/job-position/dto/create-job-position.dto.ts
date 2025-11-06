import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateJobPositionDto {
  @IsString({ message: 'Name must be a string.' })
  @IsNotEmpty({ message: 'Name is required.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  name: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string.' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters.' })
  description?: string;
}
