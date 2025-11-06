import {ArrayNotEmpty, IsArray} from 'class-validator';

export class PushJobPositionDto {
    @IsArray()
    @ArrayNotEmpty()
    jobPositionIds: number[];

    @IsArray()
    @ArrayNotEmpty()
    tenantIds: number[];
}
