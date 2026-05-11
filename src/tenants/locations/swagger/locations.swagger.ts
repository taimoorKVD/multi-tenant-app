import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {CreateLocationDto, UpdateLocationDto} from '../dto';

export const TenantLocationsSwagger = {
  Tags: () => ApiTags('Location Management'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant location',
        description: 'Creates a location record for the current tenant.',
      }),
      ApiBody({
        type: CreateLocationDto,
        examples: {
          valid: {
            summary: 'Create location example',
            value: {
              name: 'Downtown Branch',
              address: '100 Main Street',
              country_id: 1,
              state_id: 1,
              city_id: 1,
              postalCode: '10001',
            },
          },
        },
      } as any),
      ApiResponse({status: 201, description: 'Location created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List tenant locations',
        description: 'Returns tenant locations with optional pagination.',
      }),
      ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        example: 1,
        description: 'Optional page number. Defaults to 1 when provided as invalid.',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 10,
        description: 'Optional page size. Defaults to 15 when omitted; use limit=0 to return all records.',
      }),
      ApiResponse({status: 200, description: 'Locations fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search tenant locations',
        description:
          'Filters tenant locations using explicit field-by-field filters.',
      }),
      ApiQuery({
        name: 'name',
        required: false,
        type: String,
        example: 'Downtown',
        description: 'Filter by location name.',
      }),
      ApiQuery({
        name: 'address',
        required: false,
        type: String,
        example: 'Main Street',
        description: 'Filter by address.',
      }),
      ApiQuery({
        name: 'postal_code',
        required: false,
        type: String,
        example: '10001',
        description: 'Filter by postal code.',
      }),
      ApiQuery({
        name: 'country_id',
        required: false,
        type: Number,
        example: 186,
        description: 'Filter by country ID.',
      }),
      ApiQuery({
        name: 'state_id',
        required: false,
        type: Number,
        example: 530,
        description: 'Filter by state ID.',
      }),
      ApiQuery({
        name: 'city_id',
        required: false,
        type: Number,
        example: 1234,
        description: 'Filter by city ID.',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 15,
        description: 'Maximum number of records to return (1-50). Default is 15.',
      }),
      ApiResponse({
        status: 200,
        description: 'Matching tenant locations fetched successfully.',
        schema: {
          example: {
            success: true,
            tenant: 'tenant_kingdomvision',
            count: 1,
            data: [
              {
                id: 2,
                name: 'Downtown Branch',
                address: '250 Broadway Ave',
                country_id: 1,
                state_id: 1,
                city_id: 1,
                postalCode: '10007',
                latitude: null,
                longitude: null,
              },
            ],
          },
        },
      }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant location by ID',
        description: 'Returns a single location by ID for the current tenant.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Location ID'}),
      ApiResponse({status: 200, description: 'Location fetched successfully.'}),
      ApiResponse({status: 404, description: 'Location not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update tenant location',
        description: 'Updates an existing location by ID for the current tenant.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Location ID'}),
      ApiBody({
        type: UpdateLocationDto,
        examples: {
          valid: {
            summary: 'Update location example',
            value: {
              name: 'Airport Branch',
              address: '22 Airport Road',
              country_id: 1,
              state_id: 5,
              city_id: 12,
              postalCode: '90045',
            },
          },
        },
      } as any),
      ApiResponse({status: 200, description: 'Location updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'Location not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete tenant location',
        description: 'Deletes an existing location by ID for the current tenant.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Location ID'}),
      ApiResponse({status: 200, description: 'Location deleted successfully.'}),
      ApiResponse({status: 404, description: 'Location not found.'}),
    ),
};
