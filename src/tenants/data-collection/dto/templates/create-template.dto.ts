import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { TemplateSchemaDto } from './schema';

export class CreateTemplateDto {
  @ApiProperty({ example: 'Manager Report', description: 'Template / form display name.' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiPropertyOptional({
    type: TemplateSchemaDto,
    description:
      'Complete template schema: assign, report, frequency, sections, and optional conditionalRules (Form Details → Assign & Report → Frequency → Automation). Stored as JSON — field props like `value` are preserved.',
    example: {
      assign: { mode: 'individual', users: [1], jobPosition: null },
      report: { mode: 'shared', users: null, jobPosition: [1] },
      frequency: {
        type: 'atOnce',
        date: '2026-08-21',
        jobPosition: null,
        recurring: null,
      },
      formName: 'Manager Report',
      sections: [
        {
          id: 'sec_001',
          type: 'responseForm',
          name: 'Response Form',
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
                  value: 'test',
                },
              ],
            },
          ],
        },
        {
          id: 'sec_002',
          type: 'dataEntry',
          name: 'Data Entry',
          sortOrder: 2,
          rows: [
            {
              id: 'row_001',
              fields: [
                {
                  id: 'fld_002',
                  label: 'Item',
                  name: 'itemId',
                  type: 'select',
                  required: true,
                  width: '30%',
                },
              ],
            },
          ],
        },
      ],
      conditionalRules: [
        {
          id: 'logic_numeric_or',
          name: 'Cost over budget',
          enabled: true,
          conditions: {
            match: 'any',
            items: [
              {
                id: 'n_gt_fixed',
                fieldId: 'fld_cost',
                operator: 'greaterThan',
                comparison: { type: 'fixed', value: 500 },
              },
            ],
          },
          actions: [{ id: 'a_pr', type: 'purchaseRequest' }],
        },
      ],
    },
  })
  @IsOptional()
  @IsObject()
  schema?: Record<string, any>;

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
