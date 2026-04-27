import { PartialType } from '@nestjs/mapped-types';
import { CreateGlobalMailSettingDto } from './create-global-mail-setting.dto';

export class UpdateGlobalMailSettingDto extends PartialType(CreateGlobalMailSettingDto) {}