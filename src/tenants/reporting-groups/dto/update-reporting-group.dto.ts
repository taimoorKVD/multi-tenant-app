import { PartialType } from '@nestjs/mapped-types';
import { CreateReportingGroupDto } from './create-reporting-group.dto';

export class UpdateReportingGroupDto extends PartialType(CreateReportingGroupDto) {}