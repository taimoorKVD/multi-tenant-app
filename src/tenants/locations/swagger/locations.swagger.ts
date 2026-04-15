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
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations` route.',
      }),
      ApiBody({
        type: CreateLocationDto,
        examples: {
          valid: {
            summary: 'Create location example',
            value: {
              name: 'Downtown Branch',
              address: '100 Main Street',
              city: 'New York',
              country: 'USA',
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
        description: 'Returns all locations for the current tenant.',
      }),
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations` route.',
      }),
      ApiResponse({status: 200, description: 'Locations fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search tenant locations',
        description:
          'Searches tenant locations for dropdown selection by name, address, city, country, or postal code.',
      }),
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations/search` route.',
      }),
      ApiQuery({
        name: 'q',
        required: true,
        type: String,
        example: 'Downtown',
        description: 'Search keyword for existing location lookup.',
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
                city: 'New York',
                country: 'USA',
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
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations/{id}` route.',
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
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations/{id}` route.',
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
              city: 'Los Angeles',
              country: 'USA',
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
      ApiParam({
        name: 'tenantId',
        required: true,
        example: 'kingdomvision',
        description: 'Tenant slug. Required when using `/tenant/{tenantId}/locations/{id}` route.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Location ID'}),
      ApiResponse({status: 200, description: 'Location deleted successfully.'}),
      ApiResponse({status: 404, description: 'Location not found.'}),
    ),
};
