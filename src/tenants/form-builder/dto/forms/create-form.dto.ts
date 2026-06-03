import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateFormDto {
  @ApiProperty({ example: 1, description: 'Target module id.' })
  @IsInt()
  moduleId: number;

  @ApiProperty({ example: 'Users Form', description: 'Form display name.' })
  @IsString()
  @Length(2, 180)
  name: string;

  @ApiPropertyOptional({ example: 1, description: 'Actor user id.' })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
