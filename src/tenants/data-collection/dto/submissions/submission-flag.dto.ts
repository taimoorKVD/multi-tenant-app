import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { FlagSeverity } from '../../entities/enums';

export class CreateSubmissionFlagDto {
  @ApiPropertyOptional({
    nullable: true,
    example: 'temperature',
    description:
      'Field id from the pinned template version. Null/omitted = response-level flag.',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(255)
  fieldId?: string | null;

  @ApiProperty({
    example: 'Temperature seems unusually high.',
    description: 'Why this flag was raised.',
  })
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({
    enum: FlagSeverity,
    default: FlagSeverity.MEDIUM,
    example: FlagSeverity.HIGH,
  })
  @IsOptional()
  @IsEnum(FlagSeverity)
  severity?: FlagSeverity;
}

export class ResolveSubmissionFlagDto {
  @ApiPropertyOptional({
    example: 'Confirmed with employee.',
    description: 'Optional note describing how the flag was resolved.',
  })
  @IsOptional()
  @IsString()
  resolutionNote?: string;
}

export class UpdateSubmissionFlagDto {
  @ApiPropertyOptional({ example: 'Updated reason after re-check.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;

  @ApiPropertyOptional({ enum: FlagSeverity, example: FlagSeverity.CRITICAL })
  @IsOptional()
  @IsEnum(FlagSeverity)
  severity?: FlagSeverity;
}

export class FailSubmissionDto {
  @ApiProperty({
    example: 'Temperature was outside the acceptable range.',
    description: 'Required manager note explaining why the submission failed review.',
  })
  @IsString()
  @MinLength(1)
  note!: string;
}
