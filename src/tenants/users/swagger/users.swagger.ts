import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { SendUserCredentialsDto, UpdateTenantProfileDto } from '../dto';

export const TenantUsersSwagger = {
  Auth: () => ApiBearerAuth('access-token'),

  GetProfile: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get current tenant profile',
        description:
          'Returns the authenticated user profile for the Profile screen (first/last name, email, phone, role). Works for both tenant admin and tenant employee sessions. Use Authorize with the tenant access token.',
      }),
      ApiResponse({
        status: 200,
        description: 'Profile fetched successfully.',
        schema: {
          example: {
            success: true,
            message: 'Profile fetched successfully',
            tenant: 'tenant_brian',
            tenant_slug: 'brian',
            data: {
              id: 1,
              name: 'brian',
              first_name: 'brian',
              last_name: '',
              email: 'admin@brian.com',
              phone: null,
              phone_number: null,
              role: { id: 1, name: 'Admin' },
              account_type: 'Admin',
              job_position: null,
              is_system: true,
              created_at: '2026-08-06T09:15:42.017Z',
              updated_at: '2026-08-11T09:00:00.000Z',
            },
          },
        },
      }),
      ApiResponse({ status: 401, description: 'Unauthorized — missing/invalid token.' }),
      ApiResponse({ status: 404, description: 'User not found.' }),
    ),

  UpdateProfile: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Update current tenant profile',
        description:
          'Updates first_name / last_name (or name) and phone for the logged-in user. Email and role are read-only and ignored if sent.',
      }),
      ApiBody({
        type: UpdateTenantProfileDto,
        examples: {
          valid: {
            summary: 'Update name and phone',
            value: {
              first_name: 'brian',
              last_name: 'Smith',
              phone: '+1 555 0100',
            },
          },
        },
      }),
      ApiResponse({
        status: 200,
        description: 'Profile updated successfully.',
        schema: {
          example: {
            success: true,
            message: 'Profile updated successfully',
            tenant: 'tenant_brian',
            tenant_slug: 'brian',
            data: {
              id: 1,
              name: 'brian Smith',
              first_name: 'brian',
              last_name: 'Smith',
              email: 'admin@brian.com',
              phone: '+1 555 0100',
              phone_number: '+1 555 0100',
              role: { id: 1, name: 'Admin' },
              account_type: 'Admin',
              job_position: null,
            },
          },
        },
      }),
      ApiResponse({ status: 400, description: 'Validation failed.' }),
      ApiResponse({ status: 401, description: 'Unauthorized.' }),
      ApiResponse({ status: 404, description: 'User not found.' }),
    ),

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
            password: { type: 'string', example: 'StrongPass123!' },
            password_confirm: { type: 'string', example: 'StrongPass123!' },
            role_id: { type: 'number', example: 1 },
            job_position_id: { type: 'number', example: 2 },
          },
        },
        examples: {
          valid: {
            summary: 'Create user request',
            value: {
              name: 'Madeline Smith',
              email: 'madelinesmith@gmail.com',
              password: 'StrongPass123!',
              password_confirm: 'StrongPass123!',
              role_id: 1,
              job_position_id: 2,
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
          'Filters tenant users using base filters (name, email, role) and dynamic filters from form-builder custom fields. Preferred format: ?custom[department]=Operations&custom[employee_code]=EMP-001. Backward-compatible top-level custom keys are also supported.',
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
        name: 'role_id',
        required: false,
        type: Number,
        example: 1,
        description: 'Filter by role ID.',
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
                role: { id: 1, name: 'Manager' },
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
            password: { type: 'string', example: 'StrongPass123!' },
            password_confirm: { type: 'string', example: 'StrongPass123!' },
            role_id: { type: 'number', example: 1 },
            job_position_id: { type: 'number', example: 2 },
          },
        },
        examples: {
          valid: {
            summary: 'Update user request',
            value: {
              name: 'Madeline Smith',
              role_id: 1,
              job_position_id: 2,
            },
          },
          updateWithPasswordResetContext: {
            summary: 'Update user, then send update credentials template',
            value: {
              name: 'Madeline Smith',
              email: 'madelinesmith@company.com',
              role_id: 1,
              job_position_id: 2,
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
