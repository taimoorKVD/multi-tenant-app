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
                formName: 'Manager Report',
                assign: { mode: 'individual', users: null, jobPosition: [2] },
                report: { mode: 'shared', users: null, jobPosition: [1] },
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
                          {
                            id: 'fld_001',
                            label: 'Description',
                            name: 'description',
                            type: 'textarea',
                            required: true,
                            width: '100%',
                            value: 'Kitchen looks clean',
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
                          { id: 'fld_002', label: 'Item', name: 'itemId', type: 'select', required: true, width: '30%', optionSource: { type: 'dynamic', method: 'GET', endpoint: 'items', response: { dataPath: 'data', labelKey: 'name', valueKey: 'id' } } },
                          { id: 'fld_003', label: 'Include Par', name: 'includePar', type: 'checkbox', width: '10%', value: false },
                          { id: 'fld_004', label: 'Par', name: 'par', type: 'number', width: '20%', value: 10 },
                          { id: 'fld_005', label: 'User Response', name: 'userResponse', type: 'select', required: true, width: '20%', options: [{ label: 'Current Quantity', value: 'current_quantity' }, { label: 'Current Value', value: 'current_value' }], value: 'current_quantity' },
                          { id: 'fld_006', label: 'Action', name: 'action', type: 'select', required: true, width: '20%', options: [{ label: 'None', value: 'none' }, { label: 'Order', value: 'order' }], value: 'none' },
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
                          { id: 'fld_007', label: 'Description', name: 'description', type: 'textarea', width: '50%', value: '' },
                          { id: 'fld_008', label: 'Response', name: 'response', type: 'yesNo', required: true, width: '50%', options: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }], value: 'yes' },
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
                          { id: 'fld_009', label: 'Images Upload', name: 'images', type: 'image', width: '40%', value: null },
                          { id: 'fld_010', label: 'Description', name: 'description', type: 'textarea', width: '60%', value: 'Notes' },
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
      ApiResponse({
        status: 201,
        description: 'Template created and published successfully. Schema fields round-trip props like `value`.',
      }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List data collection templates',
        description:
          'Returns paginated templates. By default excludes archived. Pass status=archived to list deleted forms for restore.',
      }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiQuery({ name: 'status', required: false, enum: TemplateStatus, description: 'Filter by template status.' }),
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
              name: 'Form 1',
              status: 'draft',
              isActive: true,
              schema: {
                formName: 'Form 1',
                assign: { mode: 'individual', users: [3], jobPosition: null },
                report: { mode: 'individual', users: [3], jobPosition: null },
                frequency: { type: 'atOnce', date: '2026-08-20', jobPosition: null, recurring: null },
                sections: [
                  {
                    id: 'section_1786359677448_se9uyri',
                    type: 'custom',
                    name: 'Personal Info',
                    rows: [
                      {
                        fields: [
                          {
                            id: 'fld_1786359681840_7s5shri',
                            name: 'name',
                            type: 'text',
                            label: 'Name',
                            required: false,
                            value: 'Omais',
                          },
                        ],
                      },
                      {
                        fields: [
                          {
                            id: 'fld_1786359710579_yow725e',
                            name: 'email',
                            type: 'email',
                            label: 'Email',
                            required: false,
                            value: 'omais@gmail.com',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              createdBy: 1,
              createdAt: '2026-08-10T11:02:18.883Z',
              updatedAt: '2026-08-10T11:03:18.067Z',
            },
          },
        },
      } as any),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update template',
        description:
          'Updates template fields by ID. Schema is stored as JSON — nested field props such as `value` are preserved and returned.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({
        type: UpdateTemplateDto,
        examples: {
          valid: {
            summary: 'Update template (including field values)',
            value: {
              name: 'Form 1',
              schema: {
                formName: 'Form 1',
                assign: { mode: 'individual', users: [3], jobPosition: null },
                report: { mode: 'individual', users: [3], jobPosition: null },
                frequency: { type: 'atOnce', date: '2026-08-20', jobPosition: null, recurring: null },
                sections: [
                  {
                    id: 'section_1786359677448_se9uyri',
                    name: 'Personal Info',
                    type: 'custom',
                    rows: [
                      {
                        fields: [
                          {
                            name: 'name',
                            type: 'text',
                            label: 'Name',
                            required: false,
                            value: 'Omais',
                          },
                        ],
                      },
                      {
                        fields: [
                          {
                            name: 'email',
                            type: 'email',
                            label: 'Email',
                            required: false,
                            value: 'omais@gmail.com',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      } as any),
      ApiResponse({
        status: 200,
        description:
          'Template updated successfully. Assign/frequency schema changes auto-publish (cancel future open assignments + rematerialize) unless publish=false.',
        schema: {
          example: {
            success: true,
            message: 'Template updated and published successfully',
            data: {
              id: 16,
              name: 'Form 1',
              status: 'active',
              schema: {
                formName: 'Form 1',
                assign: { mode: 'individual', users: [3], jobPosition: null },
                report: { mode: 'individual', users: [3], jobPosition: null },
                frequency: { type: 'atOnce', date: '2026-08-20', jobPosition: null, recurring: null },
                sections: [
                  {
                    id: 'section_1786359677448_se9uyri',
                    name: 'Personal Info',
                    type: 'custom',
                    rows: [
                      {
                        fields: [
                          { name: 'name', type: 'text', label: 'Name', required: false, value: 'Omais' },
                        ],
                      },
                      {
                        fields: [
                          {
                            name: 'email',
                            type: 'email',
                            label: 'Email',
                            required: false,
                            value: 'omais@gmail.com',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      } as any),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete template',
        description:
          'Moves the template to ARCHIVED (not hard-deleted), cancels open employee assignments, and hides it from the employee portal. Use restore to bring it back.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template deleted and moved to archive.' }),
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
      ApiOperation({
        summary: 'Archive template',
        description:
          'Sets the template status to ARCHIVED, deactivates it, cancels open assignments, and hides it from the employee portal.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template archived successfully.' }),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  Restore: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Restore archived template',
        description:
          'Restores an archived template to active (or draft if unpublished). Rematerializes the current schedule: reactivates archive-cancelled occurrences, never reopens completed or manually cancelled rows, and is idempotent (no duplicate open assignments).',
      }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Template restored successfully.' }),
      ApiResponse({ status: 400, description: 'Template is not archived.' }),
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
                schema: { assign: { mode: 'shared', users: null, jobPosition: [2] }, sections: [] },
                createdBy: 1,
                createdAt: '2026-07-15T10:00:00.000Z',
              },
            ],
          },
        },
      } as any),
    ),
};
