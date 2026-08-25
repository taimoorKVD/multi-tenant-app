import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateFormDto,
  SaveSchemaDto,
  UpdateFormDto,
} from '../dto';

export const TenantFormBuilderFormsSwagger = {
  Tags: () => ApiTags('Form Builder Management - Forms'),
  Auth: () => ApiBearerAuth('access-token'),

  GetModules: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List available core modules',
        description:
          'Each module includes `type`: `dynamic` (form-builder) or `static` (lookup/reference).',
      }),
      ApiResponse({ status: 200, description: 'Modules returned successfully.' }),
    ),

  BootstrapByModule: () =>
    applyDecorators(
      ApiOperation({ summary: 'Load tenant form schema by module slug (/forms/modules/:moduleSlug)' }),
      ApiParam({ name: 'moduleSlug', type: String, example: 'users' }),
      ApiResponse({ status: 200, description: 'Module form schema returned successfully.' }),
    ),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create form definition' }),
      ApiBody({ type: CreateFormDto }),
      ApiResponse({ status: 201, description: 'Form created successfully.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List forms for active tenant',
        description:
          'Each form includes `type`: `dynamic` when the module is designed in form builder (users, items, vendors), or `static` for lookup modules (countries, states, cities, and similar).',
      }),
      ApiResponse({ status: 200, description: 'Forms returned successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get form by id' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Form returned successfully.' }),
      ApiResponse({ status: 404, description: 'Form not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update form metadata' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: UpdateFormDto }),
      ApiResponse({ status: 200, description: 'Form updated successfully.' }),
      ApiResponse({ status: 404, description: 'Form not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({ summary: 'Soft delete form' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Form deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Form not found.' }),
    ),

  SaveSchema: () =>
    applyDecorators(
      ApiOperation({ summary: 'Save complete builder schema from frontend' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: SaveSchemaDto }),
      ApiResponse({ status: 200, description: 'Schema saved successfully.' }),
      ApiResponse({ status: 400, description: 'Schema payload is invalid.' }),
    ),

  Publish: () =>
    applyDecorators(
      ApiOperation({ summary: 'Publish form and freeze immutable version' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Form published successfully.' }),
    ),

};
