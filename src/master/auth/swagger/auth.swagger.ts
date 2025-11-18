import {ApiBearerAuth, ApiBody, ApiOperation, ApiResponse,} from '@nestjs/swagger';
import {applyDecorators} from '@nestjs/common';
import {LoginDto} from '../dto';

export const MasterAuthLoginDocs = () =>
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
                    summary: 'Example login request',
                    value: {
                        email: 'superadmin@system.com',
                        password: 'SuperSecure123!',
                    },
                },
            },
        } as any),
        ApiResponse({
            status: 200,
            description:
                'Successfully authenticated. Returns JWT access token and user info.',
            schema: {
                example: {
                    success: true,
                    message: 'Login successful',
                    data: {
                        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                        user: {
                            id: 1,
                            name: 'Super Admin',
                            email: 'superadmin@system.com',
                            role: 'Super Admin',
                        },
                    },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: 'Unauthorized - Invalid credentials provided.',
            schema: {
                example: {
                    message: 'Invalid credentials',
                    error: 'Unauthorized',
                    statusCode: 401,
                },
            },
        }),
    );

export const MasterAuthGetUserDocs = () =>
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
                },
            },
        }),
    );
