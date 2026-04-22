import {applyDecorators} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';
import {CreateStateDto, UpdateStateDto} from '../dto';

export const StatesSwagger = {
  Create: () =>
    applyDecorators(
      ApiOperation({summary: 'Create state', description: 'Creates a state in master database.'}),
      ApiBody({
        type: CreateStateDto,
        examples: {
          valid: {
            summary: 'Create Sindh',
            value: {name: 'Sindh', country_id: 1},
          },
        },
      } as any),
      ApiResponse({status: 201, description: 'State created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'Country not found.'}),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List states',
        description: 'Returns paginated states sorted by name ASC. Filter by country_id is optional.',
      }),
      ApiQuery({name: 'country_id', required: false, type: Number, example: 1}),
      ApiQuery({name: 'page', required: false, type: Number, example: 1}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 15}),
      ApiResponse({status: 200, description: 'States fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search states',
        description: 'Search states by name with optional country filter.',
      }),
      ApiQuery({name: 'q', required: true, type: String, example: 'sin'}),
      ApiQuery({name: 'country_id', required: false, type: Number, example: 1}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 10}),
      ApiResponse({status: 200, description: 'States search completed.'}),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({summary: 'Get state by ID'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'State fetched successfully.'}),
      ApiResponse({status: 404, description: 'State not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({summary: 'Update state'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiBody({
        type: UpdateStateDto,
        examples: {
          valid: {
            summary: 'Update state',
            value: {name: 'Punjab', country_id: 1},
          },
        },
      } as any),
      ApiResponse({status: 200, description: 'State updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'State or country not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({summary: 'Delete state'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'State deleted successfully.'}),
      ApiResponse({status: 404, description: 'State not found.'}),
    ),
};
