import {IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class CreateJobPositionDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsOptional() @IsString() address?: string;
    @IsOptional() city?: string;
    @IsOptional() country?: string;
    @IsOptional() postalCode?: string;
}