import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateCountryDto {
  @IsString({message: 'Name must be a string.'})
  @IsNotEmpty({message: 'Name is required.'})
  @MaxLength(120, {message: 'Name must not exceed 120 characters.'})
  name!: string;

  @IsOptional()
  @IsString({message: 'Code must be a string.'})
  @MaxLength(10, {message: 'Code must not exceed 10 characters.'})
  code?: string;
}
