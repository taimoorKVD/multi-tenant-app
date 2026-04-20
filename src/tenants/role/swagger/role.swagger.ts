import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';

export const TenantRoleSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant roles',
        description: 'Returns paginated roles for the current tenant with linked permissions.',
      }),
      ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        example: 1,
        description: 'Page number (default 1).',
      }),
      ApiResponse({status: 200, description: 'Tenant roles fetched successfully.'}),
    ),

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant role',
        description: 'Creates a role and maps selected permission IDs.',
      }),
      ApiBody({
        schema: {
          example: {
            name: 'Manager',
            permissions: [1, 2, 3, 4],
          },
        }, 
      }),
      ApiResponse({status: 201, description: 'Role created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant role by ID',
        description: 'Returns a single tenant role with permission mapping.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Role ID'}),
      ApiResponse({status: 200, description: 'Role fetched successfully.'}),
      ApiResponse({status: 404, description: 'Role not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update tenant role',
        description: 'Updates role name and permission IDs.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Role ID'}),
      ApiBody({
        schema: {
          example: {
            name: 'Senior Manager',
            permissions: [1, 2, 5, 6], //new
          },
        },
      }),
      ApiResponse({status: 200, description: 'Role updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'Role not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete tenant role',
        description: 'Deletes a tenant role by ID.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Role ID'}),
      ApiResponse({status: 200, description: 'Role deleted successfully.'}),
      ApiResponse({status: 404, description: 'Role not found.'}),
    ),
};
