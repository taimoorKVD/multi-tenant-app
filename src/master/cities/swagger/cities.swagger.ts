import {applyDecorators} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';
import {CreateCityDto, UpdateCityDto} from '../dto';

export const CitiesSwagger = {
  Create: () =>
    applyDecorators(
      ApiOperation({summary: 'Create city', description: 'Creates a city in master database.'}),
      ApiBody({
        type: CreateCityDto,
        examples: {
          valid: {
            summary: 'Create Karachi',
            value: {name: 'Karachi', state_id: 1},
          },
        },
      } as any),
      ApiResponse({status: 201, description: 'City created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'State not found.'}),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List cities',
        description:
          'Returns cities sorted by name ASC. Filter by state_id is optional. Use limit for pagination, or limit=0 to return all records.',
      }),
      ApiQuery({name: 'state_id', required: false, type: Number, example: 1}),
      ApiQuery({name: 'page', required: false, type: Number, example: 1}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 15}),
      ApiResponse({status: 200, description: 'Cities fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search cities',
        description: 'Search cities by name with optional state filter.',
      }),
      ApiQuery({name: 'q', required: true, type: String, example: 'kar'}),
      ApiQuery({name: 'state_id', required: false, type: Number, example: 1}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 15}),
      ApiResponse({status: 200, description: 'Cities search completed.'}),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({summary: 'Get city by ID'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'City fetched successfully.'}),
      ApiResponse({status: 404, description: 'City not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({summary: 'Update city'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiBody({
        type: UpdateCityDto,
        examples: {
          valid: {
            summary: 'Update city',
            value: {name: 'Lahore', state_id: 2},
          },
        },
      } as any),
      ApiResponse({status: 200, description: 'City updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'City or state not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({summary: 'Delete city'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'City deleted successfully.'}),
      ApiResponse({status: 404, description: 'City not found.'}),
    ),
};