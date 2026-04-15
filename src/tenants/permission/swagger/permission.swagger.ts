import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiParam, ApiResponse} from '@nestjs/swagger';

export const TenantPermissionSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant permissions',
        description: 'Returns all permissions available for the current tenant.',
      }),
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/permissions` route.',
      }),
      ApiResponse({status: 200, description: 'Permissions fetched successfully.'}),
    ),
};
