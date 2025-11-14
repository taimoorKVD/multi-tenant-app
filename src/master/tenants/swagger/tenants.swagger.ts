import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse,} from '@nestjs/swagger';
import {CreateTenantDto} from '../dto';

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
                    'Creates a new tenant in the master database. This operation automatically provisions a tenant database, generates a subdomain, creates the first admin account, and assigns default permissions.',
            }),
            ApiBody({
                description:
                    'Tenant creation payload. The `name` field is required; `customDomain` is optional. ' +
                    'Subdomain, database name, URLs, and admin credentials are auto-generated.',
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

    // 🔍 Get one tenant by ID
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

    // ✏️ Update tenant
    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update tenant details',
                description:
                    'Updates the information of an existing tenant. Typically used for renaming or updating subdomain/domain details.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Unique identifier of the tenant to update.',
            }),
            ApiBody({
                description: 'Partial tenant update payload.',
                schema: {
                    example: {
                        name: 'Updated Tenant Name',
                        subdomain: 'updated-subdomain',
                    },
                },
            }),
            ApiResponse({
                status: 200,
                description: 'Tenant updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Tenant updated successfully',
                        data: {
                            id: 1,
                            name: 'Updated Tenant Name',
                            dbName: 'tenant_updated-subdomain',
                            subdomain: 'updated-subdomain',
                            updatedAt: '2025-11-14T12:30:00.511Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description: 'Invalid or duplicate update data.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Subdomain already in use.',
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
                description: 'Unexpected error during update.',
                schema: {
                    example: {
                        statusCode: 500,
                        message: 'Internal server error while updating tenant.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    // 🗑️ Delete tenant
    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete tenant',
                description:
                    'Deletes a tenant from the system. Use with caution — this may cascade delete tenant-related databases.',
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
                        message: 'Record deleted successfully',
                        data: null,
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
                description: 'Unexpected error during deletion.',
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
