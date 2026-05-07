import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse} from '@nestjs/swagger';

export const TenantPermissionSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant permissions',
        description: 'Returns all permissions available for the current tenant.',
      }),
      ApiResponse({status: 200, description: 'Permissions fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search tenant permissions',
        description: 'Filters tenant permissions by explicit field filters.',
      }),
      ApiQuery({
        name: 'name',
        required: false,
        type: String,
        example: 'view-user',
        description: 'Filter by permission name.',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 15,
        description: 'Maximum number of records to return (1-50). Default is 15.',
      }),
      ApiResponse({status: 200, description: 'Matching permissions fetched successfully.'}),
    ),
};
