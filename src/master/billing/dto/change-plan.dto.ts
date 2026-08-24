import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { BillingCycle } from '../entities';

export class ChangePlanDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiPropertyOptional({
    enum: BillingCycle,
    example: BillingCycle.YEARLY,
    description: 'Keep the current cycle when omitted. Yearly uses the plan yearly price.',
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorate immediately in Stripe. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  prorate?: boolean;
}
