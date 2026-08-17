import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { BillingCycle, PlanStatus } from '../entities';

export class CreatePlanDto {
  @ApiProperty({ example: 'Professional' })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'professional' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({ example: 'For growing restaurant groups' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 750, description: 'Price in major currency units (EUR). Converted to cents internally.' })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ enum: BillingCycle, example: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  usersLimit?: number | null;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  storageGb?: number | null;

  @ApiPropertyOptional({ example: 'Priority support' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  supportLevel?: string;

  @ApiPropertyOptional({ example: ['50 users', '100 GB storage', 'Priority support'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({
    example: ['dashboard', 'users', 'items', 'data-collection'],
    description:
      'Tenant modules enabled for this plan. Omit or send all keys to allow every module. Unknown keys are ignored. Dashboard is always included.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: PlanStatus, example: PlanStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
