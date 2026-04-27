import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateGlobalMailSettingDto } from '../../../master/mail/dto';

export class CreateTenantMailSettingDto extends CreateGlobalMailSettingDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  use_global_fallback?: boolean;
}
