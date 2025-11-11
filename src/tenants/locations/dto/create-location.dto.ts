import {IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class CreateLocationDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional() @IsString() address?: string;
    @IsOptional() city?: string;
    @IsOptional() country?: string;
    @IsOptional() postalCode?: string;
}