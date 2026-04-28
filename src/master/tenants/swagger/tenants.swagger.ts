import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse,} from '@nestjs/swagger';
import {CreateTenantDto, SendTenantCredentialsDto} from '../dto';

export const TenantSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    FindAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get all tenants (paginated)',
                description:
                    'Retrieves a list of all tenants managed under the master system. Requires "view-tenant" permission.',
            }),
            ApiResponse({
                status: 200,
                description: 'List of tenants retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: 'Tenant 1',
                                dbName: 'tenant_tenant_1',
                                subdomain: 'tenant-1',
                                customDomain: null,
                                createdAt: '2025-11-06T09:51:33.840Z',
                            },
                            {
                                id: 2,
                                name: 'Qavi',
                                dbName: 'tenant_qavi',
                                subdomain: 'qavi',
                                customDomain: null,
                                createdAt: '2025-11-05T13:19:15.896Z',
                            },
                        ],
                        meta: {total: 2, page: 1, lastPage: 1},
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
                schema: {
                    example: {
                        statusCode: 500,
                        message: 'Internal server error. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create a new tenant',
                description:
                    'Creates a new tenant in the master database. This operation automatically provisions a tenant database, generates a subdomain, creates the first admin account, and assigns default permissions. The response includes tenant `id` for follow-up actions like sending credentials.',
            }),
            ApiBody({
                description:
                    'Tenant creation payload. The `name` field is required; `customDomain` is optional. ' +
                    'Subdomain, database name, URLs, and admin credentials are auto-generated. ' +
                    'Credentials can be sent later via the dedicated send-credentials endpoint.',
                type: CreateTenantDto,
                examples: {
                    valid_minimal: {
                        summary: 'Example: Minimal tenant creation',
                        value: {
                            name: 'Travel Agency',
                        },
                    },
                    with_custom_domain: {
                        summary: 'Example: Tenant with custom domain',
                        value: {
                            name: 'Luxury Resorts',
                            customDomain: 'luxuryresorts.co.uk',
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 201,
                description:
                    'Tenant created successfully — subdomain and admin credentials are automatically generated.',
                schema: {
                    example: {
                        success: true,
                        message: 'Tenant "Travel Agency" created successfully',
                        data: {
                            id: 1,
                            name: 'Travel Agency',
                            database: 'tenant_travel_agency',
                            subdomain: 'travel-agency',
                            customDomain: null,
                            subdomainUrl: 'https://travel-agency.com',
                            customDomainUrl: null,
                            admin: {
                                email: 'admin@travel-agency.com',
                                password: 'Admin@123',
                                role: {
                                    id: 1,
                                    name: 'Admin',
                                    permissions: [
                                        { id: 1, name: 'create-user' },
                                        { id: 8, name: 'edit-user' },
                                    ],
                                },
                            },
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Validation failed or tenant already exists. Usually caused by missing name or duplicate record.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Tenant name must be at least 2 characters long.',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description:
                    'Unexpected server error while creating tenant. May indicate a database connection or provisioning failure.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'Failed to create tenant. Please try again later or contact support.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    SendCredentials: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Send tenant credentials email',
                description:
                    'Sends tenant admin login credentials to the provided email address after tenant creation. Use the tenant `id` returned by create-tenant response as the route parameter.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 1,
                description: 'Tenant ID for which credentials will be sent.',
            }),
            ApiBody({
                description: 'Recipient email from the modal input field.',
                type: SendTenantCredentialsDto,
                examples: {
                    send_to_input_email: {
                        summary: 'Send credentials to input email',
                        value: {
                            email: 'omais.kv@gmail.com',
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 201,
                description: 'Credentials email sent successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Tenant credentials email sent to omais.kv@gmail.com',
                        data: {
                            tenantId: 1,
                            tenant: 'Travel Agency',
                            recipient: 'omais.kv@gmail.com',
                            login_email: 'admin@travel-agency.com',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Tenant not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Tenant with ID 99 not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description: 'SMTP sender/config validation failed or provider rejected sender identity.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Unable to send tenant credentials email: Message failed: 550-From header sender domain not verified (yourdomain.com)',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
                schema: {
                    example: {
                        statusCode: 500,
                        message: 'An unexpected error occurred while sending credentials email.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    FindOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get tenant by ID',
                description:
                    'Retrieves the details of a specific tenant record using its unique ID.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 1,
                description: 'Unique identifier of the tenant.',
            }),
            ApiResponse({
                status: 200,
                description: 'Tenant details retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record fetched successfully',
                        data: {
                            id: 1,
                            name: 'Tenant 1',
                            dbName: 'tenant_tenant_1',
                            subdomain: 'tenant-1',
                            customDomain: null,
                            createdAt: '2025-11-06T09:51:33.840Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Tenant not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Record not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected error retrieving tenant.',
                schema: {
                    example: {
                        statusCode: 500,
                        message: 'Internal server error while fetching tenant.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update tenant details',
                description:
                    'Updates an existing tenant record in the master system. ' +
                    'Only editable fields such as `name` and `customDomain` may be updated. ' +
                    'Fields like `id` and `dbName` are protected and ignored if provided.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 2,
                description: 'Unique numeric identifier of the tenant to update.',
            }),
            ApiBody({
                description:
                    'Payload for updating a tenant record. Only non-empty values are applied. ' +
                    'Sending an empty object or invalid data will return a 400 error.',
                schema: {
                    example: {
                        name: 'Travel Agency International',
                        customDomain: 'travelagency.co.uk',
                    },
                },
            }),
            ApiResponse({
                status: 200,
                description: 'Tenant updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Tenant "Travel Agency International" updated successfully',
                        data: {
                            id: 2,
                            name: 'Travel Agency International',
                            customDomain: 'travelagency.co.uk',
                            dbName: 'tenant_travel_agency',
                            subdomain: 'travel-agency',
                            updatedAt: '2025-11-14T15:15:30.511Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Invalid request payload, empty update object, or invalid tenant ID provided.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'No valid fields provided for update.',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Tenant with the given ID was not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Tenant with ID 99 not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description:
                    'Unexpected server or database error while updating tenant. Usually caused by connectivity or schema issues.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'An unexpected error occurred while updating the tenant. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete tenant',
                description:
                    'Deletes a tenant from the system along with its associated tenant database. ' +
                    'This action is irreversible — use with caution.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Unique identifier of the tenant to delete.',
            }),
            ApiResponse({
                status: 200,
                description: 'Tenant deleted successfully.',
                schema: {
                    example: {
                        success: true,
                        message:
                            'Tenant "Recruiters" and its database "tenant_recruiters" deleted successfully.',
                        deleted: {
                            name: 'Recruiters',
                            dbName: 'tenant_recruiters',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Invalid tenant ID or deletion not allowed (e.g. protected system tenant).',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Invalid tenant ID provided.',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Tenant not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Record not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description:
                    'Unexpected server error while attempting to delete tenant or drop its database.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'An unexpected error occurred while deleting the tenant. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),
};
