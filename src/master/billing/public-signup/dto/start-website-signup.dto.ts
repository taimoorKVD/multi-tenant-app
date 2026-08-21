import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BillingCycle } from '../../entities';

export class StartWebsiteSignupDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    example: 'acme.com',
    description: 'Tenant domain. Used as subdomain, e.g. acme.eusocial.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain!: string;

  @ApiProperty({
    example: 'hello@acme.com',
    description: 'Business email. Used as the tenant admin login email.',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({ example: '+1' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  phoneCountryCode?: string;

  @ApiPropertyOptional({ example: '2025550147' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Multi-location restaurant group', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  countryId?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stateId?: number;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ example: '123 Main Street', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: '78701' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ example: 2, description: 'Selected subscription plan id' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiPropertyOptional({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ example: 14, description: 'Optional trial length in days' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({
    example: 'https://yoursite.com/signup/success?session_id={CHECKOUT_SESSION_ID}',
    description: 'Website URL Stripe redirects to after payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  successUrl?: string;

  @ApiPropertyOptional({
    example: 'https://yoursite.com/signup/cancel',
    description: 'Website URL Stripe redirects to if checkout is cancelled.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelUrl?: string;

  @ApiHideProperty()
  @Allow()
  admin?: unknown;

  @ApiHideProperty()
  @Allow()
  industry?: unknown;
}
