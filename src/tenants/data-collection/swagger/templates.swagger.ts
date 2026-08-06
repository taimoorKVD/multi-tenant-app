import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateTemplateDto, UpdateTemplateDto } from '../dto';
import { TemplateStatus } from '../entities/enums';

export const TenantDataCollectionTemplatesSwagger = {
  Tags: () => ApiTags('Data Collection - Templates'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create data collection template', description: 'Creates a new data collection template.' }),
      ApiBody({
        type: CreateTemplateDto,
        examples: {
          valid: {
            summary: 'Create template',
            value: {
              name: 'Manager Report',
              schema: {
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
                    name: 'Response Form',
                    sortOrder: 1,
                    rows: [
                      {
                        id: 'row_001',
                        fields: [
                          { id: 'fld_001', label: 'Description', name: 'description', type: 'textarea', required: true, width: '100%' },
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
                          { id: 'fld_002', label: 'Item', name: 'itemId', type: 'select', required: true, width: '30%', optionSource: { type: 'dynamic', method: 'GET', endpoint: 'items', response: { dataPath: 'data', labelKey: 'name', valueKey: 'id' } } },
                          { id: 'fld_003', label: 'Include Par', name: 'includePar', type: 'checkbox', width: '10%' },
                          { id: 'fld_004', label: 'Par', name: 'par', type: 'number', width: '20%' },
                          { id: 'fld_005', label: 'User Response', name: 'userResponse', type: 'select', required: true, width: '20%', options: [{ label: 'Current Quantity', value: 'current_quantity' }, { label: 'Current Value', value: 'current_value' }] },
                          { id: 'fld_006', label: 'Action', name: 'action', type: 'select', required: true, width: '20%', options: [{ label: 'None', value: 'none' }, { label: 'Order', value: 'order' }] },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'sec_003',
                    type: 'checklist',
                    name: 'Checklist Form',
                    sortOrder: 3,
                    rows: [
                      {
                        id: 'row_001',
                        fields: [
                          { id: 'fld_007', label: 'Description', name: 'description', type: 'textarea', width: '50%' },
                          { id: 'fld_008', label: 'Response', name: 'response', type: 'yesNo', required: true, width: '50%', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] },
                        ],
                      },
                    ],
                  },
                  {
                    id: 'sec_004',
                    type: 'visual',
                    name: 'Visual Form',
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
              publish: true,
            },
          },
        },
      } as any),
      ApiResponse({ status: 201, description: 'Template created and published successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List data collection templates', description: 'Returns paginated templates.' }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Templates fetched successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get template by ID', description: 'Fetches a single template with its schema and assignments.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({
        status: 200,
        description: 'Template fetched successfully.',
        schema: {
          example: {
            success: true,
            data: {
              id: 1,
              name: 'Manager Report',
              status: 'active',
              isActive: true,
              schema: {
                assign: { users: [1], jobPosition: [2] },
                report: { users: [3], jobPosition: [1] },
                frequency: { type: 'atOnce', date: '2026-08-21', jobPosition: null, recurring: null },
                sections: [
                  { id: 'sec_001', type: 'responseForm', name: 'Response Form', sortOrder: 1, rows: [{ id: 'row_001', fields: [{ id: 'fld_001', label: 'Description', name: 'description', type: 'textarea', required: true, width: '100%' }] }] },
                  { id: 'sec_002', type: 'dataEntry', name: 'Data Entry', sortOrder: 2, rows: [{ id: 'row_001', fields: [{ id: 'fld_002', label: 'Item', name: 'itemId', type: 'select', required: true, width: '30%' }] }] },
                ],
              },
              createdBy: 1,
              createdAt: '2026-07-15T10:00:00.000Z',
            },
          },
        },
      } as any),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update template', description: 'Updates template fields by ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({
        type: UpdateTemplateDto,
        examples: {
          valid: {
            summary: 'Update template',
            value: {
              name: 'Updated Manager Report',
              schema: {
                assign: { users: [1, 5], jobPosition: [2] },
                report: { users: [3], jobPosition: [1] },
                frequency: { type: 'atOnce', date: '2026-08-21', jobPosition: null, recurring: null },
                sections: [],
              },
            },
          },
        },
      } as any),
      ApiResponse({ status: 200, description: 'Template updated successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({ summary: 'Delete template', description: 'Soft-deletes a template by ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Publish: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Publish template',
        description:
          'Publishes the current schema as a new active version and materializes assignments from Assign & Report + Frequency.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template published successfully.' }),
      ApiResponse({ status: 400, description: 'Missing assign/frequency or invalid schema.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Activate: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Activate template',
        description: 'Re-enables a previously published template. Use publish to create versions and assignments.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template activated successfully.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Archive: () =>
    applyDecorators(
      ApiOperation({ summary: 'Archive template', description: 'Sets the template status to ARCHIVED.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template archived successfully.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({ summary: 'Search templates', description: 'Filters templates by name and/or status.' }),
      ApiQuery({ name: 'name', required: false, type: String, example: 'manager', description: 'Filter by template name.' }),
      ApiQuery({ name: 'status', required: false, enum: TemplateStatus, description: 'Filter by template status.' }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15, description: 'Maximum records to return (1-50). Default is 15.' }),
      ApiResponse({
        status: 200,
        description: 'Matching templates fetched successfully.',
        schema: {
          example: {
            success: true,
            count: 1,
            data: [
              {
                id: 1,
                name: 'Manager Report',
                status: 'active',
                isActive: true,
                schema: { assign: { users: [1], jobPosition: [2] }, sections: [] },
                createdBy: 1,
                createdAt: '2026-07-15T10:00:00.000Z',
              },
            ],
          },
        },
      } as any),
    ),
};
