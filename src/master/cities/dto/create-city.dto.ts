import {IsNotEmpty, IsNumber, IsString, MaxLength} from 'class-validator';

export class CreateCityDto {
  @IsNotEmpty({message: 'Name is required.'})
  @IsString({message: 'Name must be a string.'})
  @MaxLength(120, {message: 'Name must not exceed 120 characters.'})
  name!: string;

  @IsNumber({}, {message: 'State ID must be numeric.'})
  state_id!: number;
}