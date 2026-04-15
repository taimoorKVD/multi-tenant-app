import {Type} from 'class-transformer';
import {ArrayUnique, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class CreateJobPositionDto {
    @IsNotEmpty()
    @IsString()
    @MaxLength(100)
    name: string;

    @IsOptional()
    @IsString()
    @MaxLength(5000)
    description?: string;

    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @Type(() => Number)
    @IsInt({each: true})
    permissionIds?: number[];
}
