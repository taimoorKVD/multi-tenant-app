import { PartialType } from '@nestjs/mapped-types';
import { CreateReportingCategoryDto } from './create-reporting-category.dto';

export class UpdateReportingCategoryDto extends PartialType(CreateReportingCategoryDto) {}