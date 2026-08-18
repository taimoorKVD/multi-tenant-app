import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ChangePlanDto {
  @ApiProperty({ example: 4 })
  @IsInt()
  @Min(1)
  planId!: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Prorate immediately in Stripe. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  prorate?: boolean;
}
