import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { SendUserCredentialsDto } from '../dto';

export const TenantUsersSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  Create: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Create tenant user',
        description:
          'Creates a new user in the current tenant database using the active form-builder schema. Custom fields are allowed and stored dynamically.',
      }),
      ApiBody({
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            name: { type: 'string', example: 'Madeline Smith' },
            email: { type: 'string', example: 'madelinesmith@gmail.com' },
            phone_number: { type: 'string', example: '+1 718 7955 6664' },
            address: { type: 'string', example: '409 E100 ST New York NY 10122' },
            username: { type: 'string', example: 'madeline' },
            password: { type: 'string', example: 'StrongPass123!' },
            password_confirm: { type: 'string', example: 'StrongPass123!' },
            role_id: { type: 'number', example: 1 },
            job_position_id: { type: 'number', example: 1 },
            location_id: { type: 'number', example: 1 },
            availability_days: {
              type: 'array',
              items: { type: 'string' },
              example: ['Monday', 'Thursday', 'Saturday'],
            },
          },
        },
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
      }),
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
          'Returns tenant users with optional pagination.',
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
          'Filters tenant users using base filters (name, email, username, phone, role, job position, location) and dynamic filters from form-builder custom fields. Preferred format: ?custom[department]=Operations&custom[employee_code]=EMP-001. Backward-compatible top-level custom keys are also supported.',
      }),
      ApiQuery({
        name: 'name',
        required: false,
        type: String,
        example: 'madel',
        description: 'Filter by user name.',
      }),
      ApiQuery({
        name: 'email',
        required: false,
        type: String,
        example: 'gmail.com',
        description: 'Filter by email.',
      }),
      ApiQuery({
        name: 'username',
        required: false,
        type: String,
        example: 'madeline',
        description: 'Filter by username.',
      }),
      ApiQuery({
        name: 'address',
        required: false,
        type: String,
        example: '123 Elm Street',
        description: 'Filter by user address.',
      }),
      ApiQuery({
        name: 'phone_number',
        required: false,
        type: String,
        example: '+1 718',
        description: 'Filter by phone number.',
      }),
      ApiQuery({
        name: 'role_id',
        required: false,
        type: Number,
        example: 1,
        description: 'Filter by role ID.',
      }),
      ApiQuery({
        name: 'job_position_id',
        required: false,
        type: Number,
        example: 2,
        description: 'Filter by job position ID.',
      }),
      ApiQuery({
        name: 'location_id',
        required: false,
        type: Number,
        example: 3,
        description: 'Filter by location ID.',
      }),
      ApiQuery({
        name: 'custom',
        required: false,
        style: 'deepObject',
        explode: true,
        schema: {
          type: 'object',
          additionalProperties: { type: 'string' },
          example: {
            department: 'Operations',
            employee_code: 'EMP-001',
          },
        },
        description:
          'Dynamic custom-field filters from form builder. Example query: custom[department]=Operations&custom[employee_code]=EMP-001',
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
                department: 'Operations',
                employee_code: 'EMP-001',
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
          'Updates tenant user fields using the active form-builder schema. Custom fields are allowed and merged into the stored dynamic payload. To send credentials email after updating, call POST /users/:id/send-credentials.',
      }),
      ApiParam({
        name: 'id',
        type: Number,
        example: 1,
        description: 'Tenant user ID',
      }),
      ApiBody({
        schema: {
          type: 'object',
          additionalProperties: true,
          properties: {
            name: { type: 'string', example: 'Madeline Smith' },
            email: { type: 'string', example: 'madelinesmith@company.com' },
            phone_number: { type: 'string', example: '+1 718 7955 6664' },
            address: { type: 'string', example: '409 E100 ST New York NY 10122' },
            username: { type: 'string', example: 'madeline' },
            password: { type: 'string', example: 'StrongPass123!' },
            password_confirm: { type: 'string', example: 'StrongPass123!' },
            role_id: { type: 'number', example: 1 },
            job_position_id: { type: 'number', example: 1 },
            location_id: { type: 'number', example: 1 },
            availability_days: {
              type: 'array',
              items: { type: 'string' },
              example: ['Monday', 'Thursday', 'Saturday'],
            },
          },
        },
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
              password: 'StrongPass123!',
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
