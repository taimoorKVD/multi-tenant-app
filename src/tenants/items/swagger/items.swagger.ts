import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateItemDto, UpdateItemDto } from '../dto';

export const TenantItemsSwagger = {
  Tags: () => ApiTags('Item Management'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({ summary: 'Create item', description: 'Creates an item.' }),
      ApiBody({
        type: CreateItemDto,
        examples: {
          valid: {
            summary: 'Create item',
            value: {
              name: 'Beef Sirloin',
              createdBy: 1,
              updatedBy: 1,
            },
          },
        },
      } as any),
      ApiResponse({ status: 201, description: 'Item created successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({ summary: 'List items', description: 'Returns tenant items with pagination and relations.' }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Items fetched successfully.' }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({ summary: 'Search items', description: 'Filters items by name.' }),
      ApiQuery({ name: 'name', required: false, type: String, example: 'Orange' }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 15 }),
      ApiResponse({ status: 200, description: 'Matching items fetched successfully.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get item by ID', description: 'Fetches one item by numeric ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Item fetched successfully.' }),
      ApiResponse({ status: 404, description: 'Item not found.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({ summary: 'Update item', description: 'Updates item fields.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiBody({
        type: UpdateItemDto,
        examples: {
          valid: {
            summary: 'Update item',
            value: {
              name: 'Beef Tenderloin',
              updatedBy: 2,
            },
          },
        },
      } as any),
      ApiResponse({ status: 200, description: 'Item updated successfully.' }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 404, description: 'Item not found.' }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({ summary: 'Delete item', description: 'Deletes an item by ID.' }),
      ApiParam({ name: 'id', type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Item deleted successfully.' }),
      ApiResponse({ status: 404, description: 'Item not found.' }),
    ),
};