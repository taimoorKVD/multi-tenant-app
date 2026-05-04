import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CreateUserDto, SendUserCredentialsDto, UpdateUserDto } from '../dto';

export const TenantUsersSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant user',
        description:
          'Creates a new user in the current tenant database.',
      }),
      ApiBody({
        type: CreateUserDto,
        examples: {
          valid: {
            summary: 'Create user request',
            value: {
              name: 'Madeline Smith',
              email: 'madelinesmith@gmail.com',
              phone_number: '+1 718 7955 6664',
              address: '409 E100 ST New York NY 10122',
              username: 'madeline',
              password: 'StrongPass123!',
              password_confirm: 'StrongPass123!',
              role_id: 1,
              job_position_id: 1,
              location_id: 1,
              availability_days: ['Monday', 'Thursday', 'Saturday'],
            },
          },
        },
      } as any),
      ApiResponse({
        status: 201,
        description: 'Tenant user created successfully.',
      }),
      ApiResponse({
        status: 400,
        description: 'Validation failed or email/role conflict.',
      }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant users',
        description:
          'Returns all users for the current tenant.',
      }),
      ApiResponse({
        status: 200,
        description: 'Tenant users fetched successfully.',
      }),
    ),

  Search: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Search existing tenant users',
        description:
          'Searches tenant users for dropdown selection using name, email, username, or phone number.',
      }),
      ApiQuery({
        name: 'q',
        required: true,
        type: String,
        example: 'madel',
        description: 'Search keyword for existing user lookup.',
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
        description: 'Matching tenant users fetched successfully.',
        schema: {
          example: {
            success: true,
            tenant: 'kingdomvision',
            count: 1,
            data: [
              {
                id: 5,
                name: 'Madeline Smith',
                email: 'madelinesmith@gmail.com',
                username: 'madeline',
                phone_number: '+1 718 7955 6664',
                role: { id: 1, name: 'Manager' },
                job_position: { id: 2, name: 'Shift Manager' },
                location: { id: 3, name: 'Downtown Branch' },
              },
            ],
          },
        },
      }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant user by ID',
        description:
          'Returns a specific tenant user by identifier.',
      }),
      ApiParam({
        name: 'id',
        type: Number,
        example: 1,
        description: 'Tenant user ID',
      }),
      ApiResponse({
        status: 200,
        description: 'Tenant user fetched successfully.',
      }),
      ApiResponse({
        status: 404,
        description: 'Tenant user not found.',
      }),
    ),

  Update: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update tenant user',
        description:
          'Updates tenant user fields such as name, email, and role. To send credentials email after updating, call POST /users/:id/send-credentials with template_action="update" (or "both").',
      }),
      ApiParam({
        name: 'id',
        type: Number,
        example: 1,
        description: 'Tenant user ID',
      }),
      ApiBody({
        type: UpdateUserDto,
        examples: {
          valid: {
            summary: 'Update user request',
            value: {
              name: 'Madeline Smith',
              phone_number: '+1 718 7955 6664',
              address: '409 E100 ST New York NY 10122',
              username: 'madeline',
              role_id: 1,
              job_position_id: 1,
              location_id: 1,
              availability_days: ['Monday', 'Thursday', 'Saturday'],
            },
          },
          updateWithPasswordResetContext: {
            summary: 'Update user, then send update credentials template',
            value: {
              name: 'Madeline Smith',
              email: 'madelinesmith@company.com',
              role_id: 1,
            },
          },
        },
      }),
      ApiResponse({
        status: 200,
        description: 'Tenant user updated successfully.',
      }),
      ApiResponse({
        status: 400,
        description: 'Validation failed or role/email conflict.',
      }),
      ApiResponse({
        status: 404,
        description: 'Tenant user not found.',
      }),
    ),

  Delete: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Delete tenant user',
        description:
          'Deletes a tenant user by identifier.',
      }),
      ApiParam({
        name: 'id',
        type: Number,
        example: 1,
        description: 'Tenant user ID',
      }),
      ApiResponse({
        status: 200,
        description: 'Tenant user deleted successfully.',
      }),
      ApiResponse({
        status: 404,
        description: 'Tenant user not found.',
      }),
    ),

  SendCredentials: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Send tenant user credentials',
        description:
          'Sends login credentials (email + provided password) to the specified recipient email. The user password in the database is NOT changed.',
      }),
      ApiParam({
        name: 'id',
        type: Number,
        example: 1,
        description: 'Tenant user ID',
      }),
      ApiBody({
        type: SendUserCredentialsDto,
        examples: {
          valid: {
            summary: 'Send credentials to recipient email',
            value: {
              recipient_email: 'owner@company.com',
            },
          },
        },
      }),
      ApiResponse({
        status: 200,
        description: 'Tenant user credentials sent successfully.',
      }),
      ApiResponse({
        status: 400,
        description: 'Validation failed or credentials could not be sent.',
      }),
      ApiResponse({
        status: 404,
        description: 'Tenant user not found.',
      }),
    ),
};
