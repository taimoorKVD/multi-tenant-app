import {IsInt, IsNotEmpty, IsString, MaxLength, Min} from 'class-validator';

export class CreateStateDto {
  @IsString({message: 'Name must be a string.'})
  @IsNotEmpty({message: 'Name is required.'})
  @MaxLength(120, {message: 'Name must not exceed 120 characters.'})
  name!: string;

  @IsInt({message: 'Country ID must be an integer.'})
  @Min(1, {message: 'Country ID must be greater than 0.'})
  country_id!: number;
}
