import { PartialType } from '@nestjs/mapped-types';
import { CreateFormDto } from './create-form.dto';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateFormDto extends PartialType(CreateFormDto) {
  @IsOptional()
  @IsInt()
  updatedBy?: number;
}
