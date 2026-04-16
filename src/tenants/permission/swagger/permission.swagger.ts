import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse} from '@nestjs/swagger';

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
};
