import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BillingCycle } from '../entities';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  tenantId!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiPropertyOptional({
    enum: BillingCycle,
    example: BillingCycle.YEARLY,
    description: 'Monthly uses plan.price; yearly uses plan.yearlyPrice (defaults to monthly × 12).',
  })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({
    example: true,
    description:
      'If a paymentMethodId is sent, attach it and collect payment. Stripe customer/subscription are still created when STRIPE_SECRET_KEY is set, even if this is false.',
  })
  @IsOptional()
  @IsBoolean()
  chargeNow?: boolean;

  @ApiPropertyOptional({
    example: 'pm_card_visa',
    description: 'Optional Stripe payment method id to attach to the customer.',
  })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;

  @ApiPropertyOptional({ example: 14, description: 'Override plan trial days for this subscription.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;
}
