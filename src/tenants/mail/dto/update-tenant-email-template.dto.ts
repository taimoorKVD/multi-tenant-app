import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantEmailTemplateDto } from './create-tenant-email-template.dto';

export class UpdateTenantEmailTemplateDto extends PartialType(CreateTenantEmailTemplateDto) {}
