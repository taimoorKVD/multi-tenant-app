import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse,} from '@nestjs/swagger';
import {CreateUserDto, UpdateUserDto} from '../dto';

export const UsersSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    GetAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get all users (paginated)',
                description:
                    'Retrieves a paginated list of users with their assigned roles. Includes pagination metadata (total, page, lastPage).',
            }),
            ApiQuery({
                name: 'page',
                required: false,
                example: 1,
                description: 'Page number for pagination (default = 1)',
            }),
            ApiResponse({
                status: 200,
                description: 'Paginated list of users retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: 'Super Admin',
                                email: 'superadmin@system.com',
                                role: {
                                    id: 1,
                                    name: 'Super Admin',
                                    createdAt: '2025-11-06T15:04:48.818Z',
                                    updatedAt: '2025-11-06T15:04:48.818Z',
                                },
                                createdAt: '2025-11-06T15:04:49.077Z',
                                updatedAt: '2025-11-06T15:04:49.077Z',
                            },
                            {
                                id: 2,
                                name: 'Admin User',
                                email: 'admin@system.com',
                                role: {
                                    id: 2,
                                    name: 'Admin',
                                    createdAt: '2025-11-06T15:04:48.818Z',
                                    updatedAt: '2025-11-06T15:04:48.818Z',
                                },
                                createdAt: '2025-11-06T15:04:49.077Z',
                                updatedAt: '2025-11-06T15:04:49.077Z',
                            },
                        ],
                        meta: {
                            total: 2,
                            page: '1',
                            lastPage: 1,
                        },
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
                schema: {
                    example: {
                        success: false,
                        message: 'Internal server error. Please try again later.',
                        statusCode: 500,
                    },
                },
            }),
        ),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create a new user',
                description:
                    'Creates a new user with name, email, password, and assigned role. Requires Admin privileges.',
            }),
            ApiBody({
                description: 'User creation payload',
                type: CreateUserDto,
                examples: {
                    valid: {
                        summary: 'Valid Example',
                        value: {
                            name: 'John Doe',
                            email: 'john@example.com',
                            password: 'StrongPass123!',
                            password_confirm: 'StrongPass123!',
                            role_id: 2,
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 201,
                description: 'User created successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'User created successfully',
                        data: {
                            id: 3,
                            name: 'John Doe',
                            email: 'john@example.com',
                            role: {
                                id: 2,
                                name: 'Admin',
                                createdAt: '2025-11-06T15:04:48.818Z',
                                updatedAt: '2025-11-06T15:04:48.818Z',
                            },
                            createdAt: '2025-11-14T14:17:11.893Z',
                            updatedAt: '2025-11-14T14:17:11.893Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description: 'Validation error – missing or invalid input fields.',
                schema: {
                    example: {
                        success: false,
                        message: 'Validation failed',
                        errors: {
                            email: 'Email must be a valid email address.',
                            password_confirm: 'Passwords do not match.',
                        },
                        statusCode: 400,
                    },
                },
            }),
            ApiResponse({
                status: 409,
                description: 'Conflict error – typically occurs when email already exists.',
                schema: {
                    example: {
                        success: false,
                        message: 'A user with this email already exists.',
                        statusCode: 409,
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
                schema: {
                    example: {
                        success: false,
                        message: 'Internal server error. Please try again later.',
                        statusCode: 500,
                    },
                },
            }),
        ),

    GetOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get user by ID',
                description:
                    'Fetches a single user record by its unique ID, including assigned role details. Requires "view-user" permission.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Unique identifier of the user',
            }),
            ApiResponse({
                status: 200,
                description: 'User record retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record fetched successfully',
                        data: {
                            id: 1,
                            name: 'Super Admin',
                            email: 'superadmin@system.com',
                            role: {
                                id: 1,
                                name: 'Super Admin',
                                createdAt: '2025-11-06T15:04:48.818Z',
                                updatedAt: '2025-11-06T15:04:48.818Z',
                            },
                            createdAt: '2025-11-06T15:04:49.077Z',
                            updatedAt: '2025-11-06T15:04:49.077Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'User record not found.',
                schema: {
                    example: {
                        message: 'Record not found',
                        error: 'Not Found',
                        statusCode: 404,
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
                schema: {
                    example: {
                        success: false,
                        message: 'Internal server error. Please try again later.',
                        statusCode: 500,
                    },
                },
            }),
        ),

    Update: () =>
        applyDecorators(
            ApiBearerAuth('access-token'),
            ApiOperation({
                summary: 'Update current user profile',
                description:
                    'Allows the authenticated user to update their **name** and/or **password**. ' +
                    'Email cannot be changed for security reasons. ' +
                    'Password change requires both password and confirm password fields to match.',
            }),
            ApiBody({
                description:
                    'Partial update payload — users may update their name or password. Email and role changes are not allowed.',
                type: UpdateUserDto,
                examples: {
                    update_name: {
                        summary: 'Update only the user name',
                        value: {
                            name: 'John Manager',
                        },
                    },
                    update_password: {
                        summary: 'Change password with confirmation',
                        value: {
                            password: 'SecurePass123!',
                            password_confirm: 'SecurePass123!',
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 200,
                description: 'Profile updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Profile updated successfully',
                        data: {
                            id: 1,
                            name: 'Super Admin',
                            role: {
                                id: 1,
                                name: 'Super Admin',
                            },
                            createdAt: '2025-11-06T15:04:49.077Z',
                            updatedAt: '2025-11-14T16:27:30.511Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Validation failed – invalid input, password mismatch, or empty name field.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Passwords do not match.',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'User not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'User not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Internal server error – unexpected issue while saving profile.',
                schema: {
                    example: {
                        statusCode: 500,
                        message: 'Something went wrong while updating your profile.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    UpdateProfile: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update own profile',
                description:
                    'Allows the currently authenticated user to update their own profile details (such as name or password). ' +
                    'Email updates are not allowed for security reasons. ' +
                    'If updating the password, both `password` and `password_confirm` fields are required.',
            }),

            ApiBody({
                description:
                    'Profile update payload — you may update your name or change password. ' +
                    'Email updates are not allowed for security reasons. ' +
                    'If updating the password, both `password` and `password_confirm` fields are required.',
                type: UpdateUserDto,
                examples: {
                    update_name: {
                        summary: 'Example: Update only the name',
                        value: {
                            name: 'John Manager',
                        },
                    },
                    update_password: {
                        summary: 'Example: Change password',
                        value: {
                            password: 'NewSecurePass123!',
                            password_confirm: 'NewSecurePass123!',
                        },
                    },
                    invalid_password_mismatch: {
                        summary: 'Example: Passwords do not match',
                        value: {
                            password: 'Secure123!',
                            password_confirm: 'Secure321!',
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 200,
                description: 'Profile updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Profile updated successfully',
                        data: {
                            id: 1,
                            name: 'Super Admin',
                            email: 'superadmin@system.com',
                            updatedAt: '2025-11-14T11:47:45.511Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Validation failed — for example, passwords do not match, confirm password missing, or invalid input.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Passwords do not match.',
                        error: 'Bad Request',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'User not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'User not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description:
                    'Unexpected server error — usually occurs when the database or hashing operation fails.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'Something went wrong while updating your profile. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),


    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete user by ID',
                description:
                    'Deletes a user from the system. Admin-only operation.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 3,
                description: 'ID of the user to delete',
            }),
            ApiResponse({
                status: 200,
                description: 'User deleted successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record deleted successfully',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'User not found.',
                schema: {
                    example: {
                        success: false,
                        message: 'Record not found',
                        statusCode: 404,
                    },
                },
            }),
        ),
};
