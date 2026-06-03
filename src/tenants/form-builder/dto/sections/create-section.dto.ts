import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateSectionDto {
  @ApiProperty({ example: 'Contact Info' })
  @IsString()
  @Length(1, 180)
  title: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
