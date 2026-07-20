import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

export const TenantDataCollectionTemplateVersionsSwagger = {
  Tags: () => ApiTags('Data Collection - Template Versions'),
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List template versions', description: 'Returns paginated versions for a given template.' }),
      ApiParam({ name: 'templateId', type: Number, example: 1 }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({
        status: 200,
        description: 'Template versions fetched successfully.',
        schema: {
          example: {
            success: true,
            meta: { total: 3, page: 1, lastPage: 1 },
            data: [
              { id: 3, templateId: 1, versionNumber: 3, schemaSnapshot: { sections: [] }, isActive: true, createdAt: '2026-07-16T10:00:00.000Z' },
              { id: 2, templateId: 1, versionNumber: 2, schemaSnapshot: { sections: [] }, isActive: false, createdAt: '2026-07-15T10:00:00.000Z' },
              { id: 1, templateId: 1, versionNumber: 1, schemaSnapshot: { sections: [] }, isActive: false, createdAt: '2026-07-14T10:00:00.000Z' },
            ],
          },
        },
      } as any),
      ApiResponse({ status: 404, description: 'Template not found.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get template version by ID', description: 'Fetches a single version with its schema snapshot.' }),
      ApiParam({ name: 'templateId', type: Number, example: 1 }),
      ApiParam({ name: 'id', type: Number, example: 2 }),
      ApiResponse({
        status: 200,
        description: 'Template version fetched successfully.',
        schema: {
          example: {
            success: true,
            data: {
              id: 2,
              templateId: 1,
              versionNumber: 2,
              schemaSnapshot: {
                assign: { users: [1], jobPosition: [2] },
                report: { users: [3], jobPosition: [1] },
                frequency: { type: 'recurring', startDate: '2026-07-17', schedule: { interval: 1, unit: 'month', repeat: 12 } },
                sections: [{ id: 'sec_001', type: 'responseForm', title: 'Response Form', sortOrder: 1, rows: [] }],
              },
              isActive: false,
              createdBy: 1,
              createdAt: '2026-07-15T10:00:00.000Z',
            },
          },
        },
      } as any),
      ApiResponse({ status: 404, description: 'Template version not found.' }),
    ),

  FindActive: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get active template version', description: 'Returns the latest active version for a template.' }),
      ApiParam({ name: 'templateId', type: Number, example: 1 }),
      ApiResponse({
        status: 200,
        description: 'Active template version fetched successfully.',
        schema: {
          example: {
            success: true,
            data: {
              id: 3,
              templateId: 1,
              versionNumber: 3,
              schemaSnapshot: { sections: [] },
              isActive: true,
              createdAt: '2026-07-16T10:00:00.000Z',
            },
          },
        },
      } as any),
      ApiResponse({ status: 404, description: 'No active version found.' }),
    ),

  Restore: () =>
    applyDecorators(
      ApiOperation({ summary: 'Restore template from version snapshot', description: 'Rolls back the template schema to a previous version and activates it.' }),
      ApiParam({ name: 'templateId', type: Number, example: 1 }),
      ApiParam({ name: 'versionNumber', type: Number, example: 2 }),
      ApiResponse({
        status: 200,
        description: 'Template version restored successfully.',
        schema: {
          example: {
            success: true,
            message: 'Template version restored successfully',
          },
        },
      }),
      ApiResponse({ status: 404, description: 'Template or version not found.' }),
    ),
};
