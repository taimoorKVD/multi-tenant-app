import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteImageDto {
  @ApiPropertyOptional({
    example: 'acme/reference/a1b2c3d4.png',
    description: 'Storage key from upload response (`data.key`).',
  })
  @IsOptional()
  @IsString()
  key?: string;

  @ApiPropertyOptional({
    example: '/uploads/acme/reference/a1b2c3d4.png',
    description: 'Public path from upload response (`data.path`).',
  })
  @IsOptional()
  @IsString()
  path?: string;
}
