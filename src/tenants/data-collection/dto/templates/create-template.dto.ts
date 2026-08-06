import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { TemplateSchemaDto } from './schema';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Manager Report', description: 'Template / form display name.' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({
    type: TemplateSchemaDto,
    description:
      'Complete template schema: assign, report, frequency, and sections (Form Details → Assign & Report → Frequency).',
    example: {
      assign: { users: [1], jobPosition: [2] },
      report: { users: [3], jobPosition: [1] },
      frequency: {
        type: 'atOnce',
        date: '2026-08-21',
        jobPosition: null,
        recurring: null,
      },
      sections: [
        {
          id: 'sec_001',
          type: 'responseForm',
          title: 'Response Form',
          sortOrder: 1,
          rows: [
            {
              id: 'row_001',
              fields: [
                {
                  id: 'fld_001',
                  label: 'Description',
                  name: 'description',
                  type: 'textarea',
                  required: true,
                  width: '100%',
                },
              ],
            },
          ],
        },
        {
          id: 'sec_002',
          type: 'dataEntry',
          title: 'Data Entry',
          sortOrder: 2,
          rows: [
            {
              id: 'row_001',
              fields: [
                { id: 'fld_002', label: 'Item', name: 'itemId', type: 'select', required: true, width: '30%' },
                { id: 'fld_003', label: 'Include Par', name: 'includePar', type: 'checkbox', width: '10%' },
                { id: 'fld_004', label: 'Par', name: 'par', type: 'number', width: '20%' },
                {
                  id: 'fld_005',
                  label: 'User Response',
                  name: 'userResponse',
                  type: 'select',
                  required: true,
                  width: '20%',
                  options: [
                    { label: 'Current Quantity', value: 'current_quantity' },
                    { label: 'Current Value', value: 'current_value' },
                  ],
                },
                {
                  id: 'fld_006',
                  label: 'Action',
                  name: 'action',
                  type: 'select',
                  required: true,
                  width: '20%',
                  options: [
                    { label: 'None', value: 'none' },
                    { label: 'Order', value: 'order' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'sec_003',
          type: 'checklist',
          title: 'Checklist Form',
          sortOrder: 3,
          rows: [
            {
              id: 'row_001',
              fields: [
                { id: 'fld_007', label: 'Description', name: 'description', type: 'textarea', width: '50%' },
                {
                  id: 'fld_008',
                  label: 'Response',
                  name: 'response',
                  type: 'yesNo',
                  required: true,
                  width: '50%',
                  options: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'sec_004',
          type: 'visual',
          title: 'Visual Form',
          sortOrder: 4,
          rows: [
            {
              id: 'row_001',
              fields: [
                { id: 'fld_009', label: 'Images Upload', name: 'images', type: 'image', width: '40%' },
                { id: 'fld_010', label: 'Description', name: 'description', type: 'textarea', width: '60%' },
              ],
            },
          ],
        },
      ],
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateSchemaDto)
  schema?: TemplateSchemaDto;

  @ApiPropertyOptional({
    example: true,
    description:
      'Ignored on create — templates are always published on create. Kept for API compatibility.',
    deprecated: true,
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  createdBy?: number;
}
