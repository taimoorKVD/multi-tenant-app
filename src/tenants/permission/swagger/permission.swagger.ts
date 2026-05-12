import {applyDecorators} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CreatePermissionDto, UpdatePermissionDto } from '../dto';

export const TenantPermissionSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant permissions',
        description: 'Returns tenant permissions with optional pagination.',
      }),
      ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        example: 1,
        description: 'Optional page number. Defaults to 1 when provided as invalid.',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 10,
        description: 'Optional page size. Defaults to 15 when omitted; use limit=0 to return all records.',
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

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant permission',
        description: 'Creates a new permission for the current tenant workspace.',
      }),
      ApiBody({
        description: 'Tenant permission creation payload',
        type: CreatePermissionDto,
        examples: {
          valid: {
            summary: 'Create permission request',
            value: {
              name: 'approve-vendor',
            },
          },
        },
      } as any),
      ApiResponse({ status: 201, description: 'Permission created successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed or duplicate permission name.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant permission by ID',
        description: 'Returns a single permission record for the current tenant.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1, description: 'Permission ID' }),
      ApiResponse({ status: 200, description: 'Permission fetched successfully.' }),
      ApiResponse({ status: 404, description: 'Permission not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update tenant permission',
        description: 'Updates a tenant permission by ID.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1, description: 'Permission ID' }),
      ApiBody({
        description: 'Tenant permission update payload',
        type: UpdatePermissionDto,
        examples: {
          valid: {
            summary: 'Update permission request',
            value: {
              name: 'approve-vendor-request',
            },
          },
        },
      } as any),
      ApiResponse({ status: 200, description: 'Permission updated successfully.' }),
      ApiResponse({ status: 404, description: 'Permission not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete tenant permission',
        description: 'Deletes a tenant permission by ID.',
      }),
      ApiParam({ name: 'id', type: Number, example: 1, description: 'Permission ID' }),
      ApiResponse({ status: 200, description: 'Permission deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Permission not found.' }),
    ),
};
