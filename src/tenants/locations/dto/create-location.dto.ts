import {IsNotEmpty, IsNumber, IsOptional, IsString} from 'class-validator';

export class CreateLocationDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional() @IsString() address?: string;
    @IsOptional() @IsNumber() country_id?: number;
    @IsOptional() @IsNumber() state_id?: number;
    @IsOptional() @IsNumber() city_id?: number;
    @IsOptional() postalCode?: string;
    @IsOptional() latitude?: string;
    @IsOptional() longitude?: string;
}