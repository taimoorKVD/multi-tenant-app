import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse,} from '@nestjs/swagger';
import {SendTenantCredentialsDto} from '../dto';

const tenantExample = {
    id: 12,
    name: 'Acme Corporation',
    dbName: 'tenant_acme',
    subdomain: 'acme',
    customDomain: null,
    subdomainUrl: 'https://acme.eusocial.com',
    customDomainUrl: null,
    email: 'hello@acme.com',
    phoneCountryCode: '+1',
    phoneNumber: '2025550147',
    phone: '+1 2025550147',
    industry: 'Restaurant',
    description: 'Multi-location restaurant group',
    countryId: 1,
    country: { id: 1, name: 'United States', code: 'US' },
    stateId: 5,
    state: { id: 5, name: 'Texas' },
    city: 'Austin',
    address: '123 Main Street',
    postalCode: '78701',
    status: 'trial',
    plan: 'Standard',
    planId: 2,
    subscriptionStatus: 'trial',
    billingCycle: 'monthly',
    trialEndsAt: '2026-08-27T00:00:00.000Z',
    createdAt: '2026-08-13T12:00:00.000Z',
};

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
                        data: [tenantExample],
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

    Search: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Search master tenants',
                description: 'Filters master tenants using explicit field-by-field filters.',
            }),
            ApiQuery({
                name: 'name',
                required: false,
                type: String,
                example: 'Travel',
                description: 'Filter by tenant name.',
            }),
            ApiQuery({
                name: 'db_name',
                required: false,
                type: String,
                example: 'tenant_travel_agency',
                description: 'Filter by tenant database name.',
            }),
            ApiQuery({
                name: 'subdomain',
                required: false,
                type: String,
                example: 'travel-agency',
                description: 'Filter by subdomain.',
            }),
            ApiQuery({
                name: 'custom_domain',
                required: false,
                type: String,
                example: 'travelagency.co.uk',
                description: 'Filter by custom domain.',
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
                description: 'Matching tenants fetched successfully.',
            }),
        ),

    Industries: () =>
        applyDecorators(
            ApiOperation({
                summary: 'List industries for Create Tenant',
                description: 'Returns industry options for the Create Tenant industry dropdown.',
            }),
            ApiResponse({
                status: 200,
                schema: {
                    example: {
                        success: true,
                        count: 10,
                        data: [{ name: 'Restaurant' }, { name: 'Hotel' }, { name: 'Cafe' }],
                    },
                },
            }),
        ),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create a new tenant',
                description:
                    'Creates a tenant from the Super Admin Create Tenant form: organization details, address, and plan/trial. The first admin logs in with the business email and an auto-generated password (sent by email). Provisions the tenant database and subscription.',
            }),
            ApiBody({
                description:
                    'Organization, address, and plan/trial details. The first admin is created automatically using `name` and `email`; do not send `admin`, `password`, or `confirmPassword` — credentials are generated server-side and emailed.',
                schema: {
                    type: 'object',
                    required: ['name', 'domain', 'email', 'planId'],
                    properties: {
                        name: { type: 'string', example: 'Acme Corporation' },
                        domain: { type: 'string', example: 'acme.com' },
                        email: {
                            type: 'string',
                            example: 'hello@acme.com',
                            description: 'Business email used as the tenant admin login.',
                        },
                        phoneCountryCode: { type: 'string', example: '+1' },
                        phoneNumber: { type: 'string', example: '2025550147' },
                        description: { type: 'string', example: 'Multi-location restaurant group' },
                        countryId: { type: 'number', example: 1 },
                        stateId: { type: 'number', example: 5 },
                        city: { type: 'string', example: 'Austin' },
                        address: { type: 'string', example: '123 Main Street' },
                        postalCode: { type: 'string', example: '78701' },
                        planId: { type: 'number', example: 2 },
                        billingCycle: { type: 'string', example: 'monthly' },
                        trialDays: { type: 'number', example: 14 },
                    },
                },
            }),
            ApiResponse({
                status: 201,
                description: 'Tenant created successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Tenant "Acme Corporation" created successfully',
                        data: {
                            ...tenantExample,
                            database: 'tenant_acme',
                            credentialsEmail: {
                                sent: true,
                                recipients: ['admin@acme.com'],
                                error: null,
                            },
                            loginUrl: 'https://acme.eusocial.com/',
                            loginApiUrl: 'https://api.eusocial.com/api/tenant/acme/login',
                            tenantSlug: 'acme',
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
                        data: tenantExample,
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
                    'Updates tenant organization, contact, and address fields from the Create/Edit Tenant form. Plan changes use the subscription APIs. Admin password is not updated here.',
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
                        name: 'Acme Corporation',
                        domain: 'acme.com',
                        email: 'hello@acme.com',
                        phoneCountryCode: '+1',
                        phoneNumber: '2025550147',
                        industry: 'Restaurant',
                        description: 'Multi-location restaurant group',
                        countryId: 1,
                        stateId: 5,
                        city: 'Austin',
                        address: '123 Main Street',
                        postalCode: '78701',
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
                        data: tenantExample,
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
