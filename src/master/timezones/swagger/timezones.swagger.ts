import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

export const TimezonesSwagger = {
  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List timezones',
        description:
          'Returns IANA timezones sorted by name ASC. Omit limit (or limit=0) to return all records.',
      }),
      ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
      ApiQuery({ name: 'limit', required: false, type: Number, example: 50 }),
      ApiResponse({ status: 200, description: 'Timezones fetched successfully.' }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search timezones',
        description: 'Filter by q (name/label/region), name, or region.',
      }),
      ApiQuery({ name: 'q', required: false, type: String, example: 'karachi' }),
      ApiQuery({ name: 'name', required: false, type: String, example: 'Asia/' }),
      ApiQuery({ name: 'region', required: false, type: String, example: 'Asia' }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 50,
        description: 'Maximum number of records to return (1-100). Default is 50.',
      }),
      ApiResponse({ status: 200, description: 'Timezone search completed.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({ summary: 'Get timezone by ID' }),
      ApiParam({ name: 'id', required: true, type: Number, example: 1 }),
      ApiResponse({ status: 200, description: 'Timezone fetched successfully.' }),
      ApiResponse({ status: 404, description: 'Timezone not found.' }),
    ),
};
