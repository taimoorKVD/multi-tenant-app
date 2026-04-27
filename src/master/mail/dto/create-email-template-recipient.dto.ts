import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateEmailTemplateRecipientDto {
  @ApiProperty({ example: 'to', enum: ['to', 'cc', 'bcc'] })
  @IsString()
  @IsIn(['to', 'cc', 'bcc'])
  channel: 'to' | 'cc' | 'bcc';

  @ApiProperty({ example: 'placeholder', enum: ['static', 'placeholder', 'user', 'role'] })
  @IsString()
  @IsIn(['static', 'placeholder', 'user', 'role'])
  source_type: 'static' | 'placeholder' | 'user' | 'role';

  @ApiProperty({ example: '{email}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  value: string;
}