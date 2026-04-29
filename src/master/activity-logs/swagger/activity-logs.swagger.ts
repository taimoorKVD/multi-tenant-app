import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

export const ActivityLogsSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List all activity logs' }),
      ApiQuery({ name: 'page', required: false, type: Number }),
      ApiQuery({ name: 'limit', required: false, type: Number }),
      ApiQuery({ name: 'module', required: false, type: String }),
      ApiQuery({ name: 'action', required: false, type: String }),
      ApiQuery({ name: 'method', required: false, type: String }),
      ApiQuery({ name: 'statusCode', required: false, type: Number }),
      ApiQuery({ name: 'userId', required: false, type: Number }),
      ApiQuery({ name: 'endpoint', required: false, type: String }),
      ApiQuery({ name: 'tenant', required: false, type: String }),
      ApiResponse({
        status: 200,
        description: 'Activity logs fetched successfully.',
        schema: {
          example: {
            success: true,
            message: 'Activity logs fetched successfully',
            data: [
              {
                id: 8,
                tenant: null,
                userId: 1,
                userEmail: 'superadmin@system.com',
                action: 'CREATE',
                module: 'master',
                entity: 'tenants',
                entityId: '12',
                method: 'POST',
                endpoint: '/api/master/tenants',
                statusCode: 201,
                status: 'success',
                durationMs: 67,
                createdAt: '2026-04-28T12:40:21.000Z',
              },
            ],
            meta: {
              total: 1,
              page: 1,
              lastPage: 1,
            },
          },
        },
      }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get activity log details by ID' }),
      ApiParam({ name: 'id', type: Number, required: true, example: 8 }),
      ApiResponse({
        status: 200,
        description: 'Activity log fetched successfully.',
        schema: {
          example: {
            success: true,
            message: 'Activity log fetched successfully',
            data: {
              id: 8,
              tenant: null,
              userId: 1,
              userEmail: 'superadmin@system.com',
              action: 'CREATE',
              module: 'master',
              entity: 'tenants',
              entityId: '12',
              method: 'POST',
              endpoint: '/api/master/tenants',
              statusCode: 201,
              status: 'success',
              durationMs: 67,
              query: null,
              body: {
                name: 'Travel Agency',
              },
              oldData: null,
              newData: {
                name: 'Travel Agency',
              },
              errorMessage: null,
              createdAt: '2026-04-28T12:40:21.000Z',
            },
          },
        },
      }),
      ApiResponse({
        status: 404,
        description: 'Activity log not found.',
        schema: {
          example: {
            statusCode: 404,
            message: 'Activity log with ID 999 not found.',
            error: 'Not Found',
          },
        },
      }),
    ),
};
