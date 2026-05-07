import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse} from '@nestjs/swagger';

export const PermissionSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    GetAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get all permissions (paginated)',
                description:
                    'Retrieves a paginated list of permissions available in the system. Each permission defines an allowed action for a specific module.',
            }),
            ApiQuery({
                name: 'page',
                required: false,
                example: 1,
                description: 'Page number for pagination (default = 1)',
            }),
            ApiResponse({
                status: 200,
                description: 'Paginated list of permissions retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            { id: 1, name: 'create-user' },
                            { id: 2, name: 'view-user' },
                            { id: 3, name: 'edit-user' },
                            { id: 4, name: 'delete-user' },
                            { id: 5, name: 'create-role' },
                            { id: 6, name: 'view-role' },
                        ],
                        meta: {
                            total: 20,
                            page: 1,
                            lastPage: 2,
                        },
                    },
                },
            }),
            ApiResponse({
                status: 401,
                description: 'Unauthorized - Invalid or missing access token.',
                schema: {
                    example: {
                        success: false,
                        message: 'Unauthorized',
                        statusCode: 401,
                    },
                },
            }),
        ),

    Search: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Search master permissions',
                description: 'Filters master permissions using explicit field-by-field filters.',
            }),
            ApiQuery({
                name: 'name',
                required: false,
                type: String,
                example: 'view-user',
                description: 'Filter by permission name.',
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
                description: 'Matching permissions fetched successfully.',
            }),
        ),
};
