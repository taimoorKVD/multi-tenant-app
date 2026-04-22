import {applyDecorators} from '@nestjs/common';
import {ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';
import {CreateCountryDto, UpdateCountryDto} from '../dto';

export const CountriesSwagger = {
  Create: () =>
    applyDecorators(
      ApiOperation({summary: 'Create country', description: 'Creates a country in master database.'}),
      ApiBody({
        type: CreateCountryDto,
        examples: {
          valid: {
            summary: 'Create Pakistan',
            value: {name: 'Pakistan', code: 'PK'},
          },
        },
      } as any),
      ApiResponse({status: 201, description: 'Country created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({summary: 'List countries', description: 'Returns paginated countries sorted by name ASC.'}),
      ApiQuery({name: 'page', required: false, type: Number, example: 1}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 15}),
      ApiResponse({status: 200, description: 'Countries fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({summary: 'Search countries', description: 'Search by country name or code.'}),
      ApiQuery({name: 'q', required: true, type: String, example: 'pak'}),
      ApiQuery({name: 'limit', required: false, type: Number, example: 10}),
      ApiResponse({status: 200, description: 'Countries search completed.'}),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({summary: 'Get country by ID'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'Country fetched successfully.'}),
      ApiResponse({status: 404, description: 'Country not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({summary: 'Update country'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiBody({
        type: UpdateCountryDto,
        examples: {
          valid: {
            summary: 'Rename country',
            value: {name: 'United States of America', code: 'US'},
          },
        },
      } as any),
      ApiResponse({status: 200, description: 'Country updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'Country not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({summary: 'Delete country'}),
      ApiParam({name: 'id', required: true, type: Number, example: 1}),
      ApiResponse({status: 200, description: 'Country deleted successfully.'}),
      ApiResponse({status: 404, description: 'Country not found.'}),
    ),
};
