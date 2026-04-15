import {ApiBearerAuth, ApiBody, ApiOperation, ApiResponse,} from '@nestjs/swagger';
import {applyDecorators} from '@nestjs/common';
import {LoginDto} from '../dto';

export const TenantAuthLoginDocs = () =>
    applyDecorators(
        ApiOperation({
            summary: 'Authenticate and obtain access token',
            description:
                'Logs in a master user using email and password. Returns an access token and user details.',
        }),
        ApiBody({
            description: 'Credentials for master user login',
            type: LoginDto,
            examples: {
                valid: {
                    summary: 'Valid login request example',
                    value: {
                        email: 'admin@kingdomvision.com',
                        password: 'Admin@123',
                    },
                },
                missingEmail: {
                    summary: 'Missing email field',
                    value: {
                        password: 'Admin@123',
                    },
                },
                missingPassword: {
                    summary: 'Missing password field',
                    value: {
                        email: 'admin@kingdomvision.com',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description: 'Successfully authenticated.',
            schema: {
                example: {
                    success: true,
                    message: 'Login successful',
                    tenant_slug: 'kingdomvision',
                    tenant: 'tenant_kingdomvision',
                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    user: {
                        id: 1,
                        email: 'admin@kingdomvision.com',
                        name: 'Administrator',
                        role: {
                            id: 1,
                            name: 'Senior Manager',
                            createdAt: '2026-04-14T00:52:55.371Z',
                            updatedAt: '2026-04-14T17:26:41.358Z',
                            permissions: [
                                {id: 1, name: 'create-user'},
                                {id: 2, name: 'view-job-position'},
                                {id: 5, name: 'edit-location'},
                                {id: 6, name: 'view-location'},
                            ],
                        },
                    },
                },
            },
        }),
        ApiResponse({
            status: 400,
            description: 'Validation error — missing or invalid fields.',
            schema: {
                example: {
                    success: false,
                    message: 'Validation failed',
                    errors: [
                        {
                            field: 'password',
                            messages: ['Password cannot be empty. Please enter your password.'],
                        },
                    ],
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized — incorrect email or password.',
            schema: {
                example: {
                    success: false,
                    message: 'The email or password you entered is incorrect.',
                    statusCode: 401,
                },
            },
        }),
    );

export const TenantAuthGetUserDocs = () =>
    applyDecorators(
        ApiBearerAuth('access-token'),
        ApiOperation({
            summary: 'Get authenticated user details',
            description:
                'Retrieves the currently logged-in master user’s profile based on the provided JWT token.',
        }),
        ApiResponse({
            status: 200,
            description: 'Authenticated user details',
            schema: {
                example: {
                    id: 1,
                    name: 'Super Admin',
                    email: 'superadmin@system.com',
                    role: 'Super Admin',
                    createdAt: '2025-11-10T10:22:30.000Z',
                    updatedAt: '2025-11-10T10:25:40.000Z',
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized or Session expired.',
            schema: {
                example: {
                    message: 'Your session has expired or is invalid. Please log in again.',
                    error: 'Unauthorized',
                    statusCode: 401,
                    success: false,
                },
            },
        }),
    );
