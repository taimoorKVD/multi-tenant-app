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
  AutosaveFormDto,
  CreateFormDto,
  SaveSchemaDto,
  CreateSectionDto,
  UpdateFormDto,
  UpdateLayoutDto,
  UpdateSectionDto,
} from '../dto';

export const TenantFormBuilderFormsSwagger = {
  Tags: () => ApiTags('Form Builder Management - Forms'),
  Auth: () => ApiBearerAuth('access-token'),

  GetModules: () =>
    applyDecorators(
      ApiOperation({ summary: 'List available core modules' }),
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
      ApiOperation({ summary: 'List forms for active tenant' }),
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

  Autosave: () =>
    applyDecorators(
      ApiOperation({ summary: 'Autosave draft schema state' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: AutosaveFormDto }),
      ApiResponse({ status: 200, description: 'Form autosaved successfully.' }),
    ),

  SaveSchema: () =>
    applyDecorators(
      ApiOperation({ summary: 'Save complete builder schema from frontend' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: SaveSchemaDto }),
      ApiResponse({ status: 200, description: 'Schema saved successfully.' }),
      ApiResponse({ status: 400, description: 'Schema payload is invalid.' }),
    ),

  UpdateLayout: () =>
    applyDecorators(
      ApiOperation({ summary: 'Bulk update form layout in one transaction' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: UpdateLayoutDto }),
      ApiResponse({ status: 200, description: 'Layout updated successfully.' }),
    ),

  Publish: () =>
    applyDecorators(
      ApiOperation({ summary: 'Publish form and freeze immutable version' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Form published successfully.' }),
    ),

  RuntimeSchema: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get runtime schema payload' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Runtime schema returned successfully.' }),
    ),

  CreateSection: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create form section' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: CreateSectionDto }),
      ApiResponse({ status: 201, description: 'Section created successfully.' }),
    ),

  UpdateSection: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update section' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({ type: UpdateSectionDto }),
      ApiResponse({ status: 200, description: 'Section updated successfully.' }),
      ApiResponse({ status: 404, description: 'Section not found.' }),
    ),

  DeleteSection: () =>
    applyDecorators(
      ApiOperation({ summary: 'Soft delete section' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Section deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Section not found.' }),
    ),

};
