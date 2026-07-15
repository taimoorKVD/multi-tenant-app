import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Manager Report', description: 'Template / form display name.' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({
    description: 'Complete template schema containing assign, report, frequency, and sections.',
    example: {
      assign: { users: [1], jobPosition: [2] },
      report: { users: [3], jobPosition: [1] },
      frequency: {
        type: 'recurring',
        startDate: '2026-07-17',
        endDate: null,
        jobPosition: [2],
        schedule: { interval: 1, unit: 'month', repeat: 12, monthlyRule: { type: 'dayOfMonth', day: 1 } },
      },
      sections: [
        {
          id: 'sec_001',
          type: 'responseForm',
          title: 'Response Form',
          sortOrder: 1,
          rows: [{ id: 'row_001', fields: [{ id: 'fld_001', label: 'Description', name: 'description', type: 'textarea', required: true, width: '100%' }] }],
        },
      ],
    },
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
