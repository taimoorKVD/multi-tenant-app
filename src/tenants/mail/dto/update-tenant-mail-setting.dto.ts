import { PartialType } from '@nestjs/mapped-types';
import { CreateTenantMailSettingDto } from './create-tenant-mail-setting.dto';

export class UpdateTenantMailSettingDto extends PartialType(CreateTenantMailSettingDto) {}
