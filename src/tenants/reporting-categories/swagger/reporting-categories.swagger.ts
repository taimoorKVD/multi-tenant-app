import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateReportingCategoryDto, UpdateReportingCategoryDto } from '../dto';

export const TenantReportingCategoriesSwagger = {
  Tags: () => ApiTags('Reporting Category Management'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create reporting category', description: 'Creates a reporting category for the current tenant.' }),
      ApiBody({
        type: CreateReportingCategoryDto,
        examples: {
          valid: {
            summary: 'Create reporting category',
            value: {
              reportingGroupId: 1,
              name: 'Produce',
              description: 'Fresh fruits and vegetables',
              isActive: true,
              createdBy: 1,
              updatedBy: 1,
            },
          },
        },
      } as any),
      ApiResponse({ status: 201, description: 'Reporting category created successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed or duplicate name.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List reporting categories', description: 'Returns tenant reporting categories with pagination.' }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Reporting categories fetched successfully.' }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({ summary: 'Search reporting categories', description: 'Filters reporting categories by group, name, description, and isActive.' }),
      ApiQuery({ name: 'reportingGroupId', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'name', required: false, type: String, example: 'Produce' }),
      ApiQuery({ name: 'description', required: false, type: String, example: 'Fruits and vegetables' }),
      ApiQuery({ name: 'isActive', required: false, type: Boolean, example: true }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Matching reporting categories fetched successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get reporting category by ID', description: 'Fetches one reporting category by numeric ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Reporting category fetched successfully.' }),
      ApiResponse({ status: 404, description: 'Reporting category not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update reporting category', description: 'Updates reporting category fields.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({
        type: UpdateReportingCategoryDto,
        examples: {
          valid: {
            summary: 'Update reporting category',
            value: {
              reportingGroupId: 2,
              name: 'Cleaning Supply',
              description: 'Chemicals and sanitation materials',
              isActive: true,
              updatedBy: 2,
            },
          },
        },
      } as any),
      ApiResponse({ status: 200, description: 'Reporting category updated successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 404, description: 'Reporting category not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({ summary: 'Delete reporting category', description: 'Deletes a reporting category by ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Reporting category deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Reporting category not found.' }),
    ),
};