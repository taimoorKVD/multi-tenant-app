import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateFieldTypeDto } from '../dto';

export const TenantFormBuilderFieldTypesSwagger = {
  Tags: () => ApiTags('Form Builder Management - Field Types'),
  Auth: () => ApiBearerAuth('access-token'),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List field types palette' }),
      ApiResponse({ status: 200, description: 'Field types returned successfully.' }),
    ),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create field type' }),
      ApiBody({ type: CreateFieldTypeDto }),
      ApiResponse({ status: 201, description: 'Field type created successfully.' }),
    ),
};
