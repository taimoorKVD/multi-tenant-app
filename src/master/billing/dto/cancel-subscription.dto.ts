import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({
    example: true,
    description: 'If true (default), cancel at period end. If false, cancel immediately.',
  })
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;
}
