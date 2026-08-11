import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateReportingGroupDto, UpdateReportingGroupDto } from '../dto';

export const TenantReportingGroupsSwagger = {
  Tags: () => ApiTags('Reporting Group Management'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create reporting group', description: 'Creates a reporting group for the current tenant.' }),
      ApiBody({
        type: CreateReportingGroupDto,
        examples: {
          valid: {
            summary: 'Create reporting group',
            value: {
              name: 'Product Specific',
              description: 'Products mapped by inventory class',
              isActive: true,
              createdBy: 1,
              updatedBy: 1,
            },
          },
        },
      } as any),
      ApiResponse({ status: 201, description: 'Reporting group created successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed or duplicate name.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List reporting groups',
        description:
          'Returns tenant reporting groups with nested categories and assigned items (Group → Category → Items).',
      }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Reporting groups fetched successfully.' }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({ summary: 'Search reporting groups', description: 'Filters reporting groups by name, description, and isActive.' }),
      ApiQuery({ name: 'name', required: false, type: String, example: 'Product Specific' }),
      ApiQuery({ name: 'description', required: false, type: String, example: 'Module groups' }),
      ApiQuery({ name: 'isActive', required: false, type: Boolean, example: true }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Matching reporting groups fetched successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get reporting group by ID', description: 'Fetches one reporting group by numeric ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Reporting group fetched successfully.' }),
      ApiResponse({ status: 404, description: 'Reporting group not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update reporting group', description: 'Updates reporting group fields.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({
        type: UpdateReportingGroupDto,
        examples: {
          valid: {
            summary: 'Update reporting group',
            value: {
              name: 'General Items',
              description: 'General-purpose inventory grouping',
              isActive: true,
              updatedBy: 2,
            },
          },
        },
      } as any),
      ApiResponse({ status: 200, description: 'Reporting group updated successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 404, description: 'Reporting group not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({ summary: 'Delete reporting group', description: 'Deletes a reporting group by ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Reporting group deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Reporting group not found.' }),
    ),
};