import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

export const TenantFormBuilderVersionsSwagger = {
  Tags: () => ApiTags('Form Builder Management - Versions'),
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List form versions' }),
      ApiParam({ name: 'moduleSlug', type: String, example: 'users' }),
      ApiResponse({ status: 200, description: 'Versions returned successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get form version by version number' }),
      ApiParam({ name: 'moduleSlug', type: String, example: 'users' }),
      ApiParam({ name: 'version', type: Number, example: 2 }),
      ApiResponse({ status: 200, description: 'Version returned successfully.' }),
      ApiResponse({ status: 404, description: 'Version not found.' }),
    ),

  Restore: () =>
    applyDecorators(
      ApiOperation({ summary: 'Restore form from version snapshot transactionally' }),
      ApiParam({ name: 'moduleSlug', type: String, example: 'users' }),
      ApiParam({ name: 'version', type: Number, example: 2 }),
      ApiResponse({ status: 200, description: 'Version restored successfully.' }),
      ApiResponse({ status: 404, description: 'Version not found.' }),
    ),
};
