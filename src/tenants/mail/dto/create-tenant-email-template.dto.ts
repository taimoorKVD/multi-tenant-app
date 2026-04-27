import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateEmailTemplateDto } from '../../../master/mail/dto';

export class CreateTenantEmailTemplateDto extends CreateEmailTemplateDto {
  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  master_template_id?: number;
}
