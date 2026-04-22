import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {CreateVendorDto, UpdateVendorDto} from '../dto';

export const TenantVendorsSwagger = {
  Tags: () => ApiTags('Vendor Management'),
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant vendor',
        description: 'Creates a vendor record for the current tenant.',
      }),
      ApiBody({
        type: CreateVendorDto,
        examples: {
          valid: {
            summary: 'Create vendor example',
            value: {
              name: 'Fresh Foods Supplier',
              address: '250 Market Street',
              city: 'Los Angeles',
              country_id: 1,
              state_id: 1,
              phone_number: '+1 310 555 0100',
              email: 'orders@freshfoods.com',
              contact_person: 'John Carter',
              contact_phone: '+1 310 555 0101',
              contact_email: 'john@freshfoods.com',
              website: 'https://freshfoods.com',
              username: 'freshfoods_vendor',
              password: 'StrongVendorPass123',
              min_order: 150,
              payment_methods: ['cod', 'eft'],
              contacts: [
                {
                  name: 'John Carter',
                  phone_number: '+1 310 555 0101',
                  email: 'john@freshfoods.com',
                  is_primary: true,
                },
              ],
              order_deadlines: [
                { day: 'monday' },
                { day: 'wednesday' },
                { day: 'friday' },
              ],
              instructions: 'Deliver between 8AM and 11AM',
            },
          },
        },
      } as any),
      ApiResponse({status: 201, description: 'Vendor created successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List tenant vendors',
        description: 'Returns all vendors for the current tenant.',
      }),
      ApiResponse({status: 200, description: 'Vendors fetched successfully.'}),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search tenant vendors',
        description: 'Searches vendors by name, email, contact person, or phone number.',
      }),
      ApiQuery({
        name: 'q',
        required: true,
        type: String,
        example: 'fresh',
        description: 'Search keyword for vendor lookup.',
      }),
      ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        example: 15,
        description: 'Maximum records to return (1-50).',
      }),
      ApiResponse({
        status: 200,
        description: 'Matching vendors fetched successfully.',
      }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant vendor by ID',
        description: 'Returns a single vendor by ID.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Vendor ID'}),
      ApiResponse({status: 200, description: 'Vendor fetched successfully.'}),
      ApiResponse({status: 404, description: 'Vendor not found.'}),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update tenant vendor',
        description: 'Updates an existing vendor record by ID.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Vendor ID'}),
      ApiBody({
        type: UpdateVendorDto,
        examples: {
          valid: {
            summary: 'Update vendor example',
            value: {
              city: 'San Diego',
              payment_methods: ['eft'],
              contacts: [
                {
                  name: 'Maya Scott',
                  phone_number: '+1 310 555 0102',
                  email: 'maya@freshfoods.com',
                  is_primary: true,
                },
              ],
              instructions: 'Use back entrance for deliveries.',
            },
          },
        },
      } as any),
      ApiResponse({status: 200, description: 'Vendor updated successfully.'}),
      ApiResponse({status: 400, description: 'Validation failed.'}),
      ApiResponse({status: 404, description: 'Vendor not found.'}),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete tenant vendor',
        description: 'Deletes an existing vendor by ID.',
      }),
      ApiParam({name: 'id', type: Number, example: 1, description: 'Vendor ID'}),
      ApiResponse({status: 200, description: 'Vendor deleted successfully.'}),
      ApiResponse({status: 404, description: 'Vendor not found.'}),
    ),
};
