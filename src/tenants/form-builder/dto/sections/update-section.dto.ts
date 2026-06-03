import { PartialType } from '@nestjs/mapped-types';
import { CreateSectionDto } from './create-section.dto';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateSectionDto extends PartialType(CreateSectionDto) {
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
