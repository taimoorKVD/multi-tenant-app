import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';
import {UpdateJobPositionDto} from "../dto";

export const JobPositionSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    GetAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'List all job positions',
                description:
                    'Retrieves a paginated list of job positions, ordered by creation date.',
            }),
            ApiQuery({
                name: 'page',
                required: false,
                type: Number,
                example: 1,
                description: 'Page number for pagination (default: 1).',
            }),
            ApiResponse({
                status: 200,
                description: 'Paginated list of job positions.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: 'Project Manager',
                                description: 'Oversees project execution and delivery.',
                                createdAt: '2025-11-10T10:00:00.000Z',
                                updatedAt: '2025-11-10T11:00:00.000Z',
                            },
                            {
                                id: 2,
                                name: 'Software Engineer',
                                description: 'Develops and maintains software solutions.',
                                createdAt: '2025-11-10T10:15:00.000Z',
                                updatedAt: '2025-11-10T11:10:00.000Z',
                            },
                        ],
                        meta: {
                            total: 2,
                            page: 1,
                            lastPage: 1,
                        },
                    },
                },
            }),
        ),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create a new job position',
                description:
                    'Creates a new job position in the master database with the provided details.',
            }),
            ApiBody({
                description: 'Job position creation payload.',
                schema: {
                    example: {
                        name: 'Operations Lead',
                        description: 'Responsible for overseeing daily operational tasks.',
                    },
                },
            }),
            ApiResponse({
                status: 201,
                description: 'Job position created successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Job position created successfully',
                        data: {
                            id: 3,
                            name: 'Operations Lead',
                            description: 'Responsible for overseeing daily operational tasks.',
                            createdAt: '2025-11-14T14:15:00.000Z',
                            updatedAt: '2025-11-14T14:15:00.000Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description: 'Validation error or missing fields.',
                schema: {
                    example: {
                        statusCode: 400,
                        message: 'Name is required.',
                        error: 'Bad Request',
                    },
                },
            }),
        ),

    FindOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Retrieve a specific job position',
                description: 'Fetches a single job position by its numeric ID.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 2,
                description: 'Unique ID of the job position.',
            }),
            ApiResponse({
                status: 200,
                description: 'Job position details retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record fetched successfully',
                        data: {
                            id: 2,
                            name: 'Software Engineer',
                            description: 'Responsible for coding and debugging.',
                            createdAt: '2025-11-10T10:00:00.000Z',
                            updatedAt: '2025-11-10T11:00:00.000Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Record not found',
                        error: 'Not Found',
                    },
                },
            }),
        ),

    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update an existing job position',
                description:
                    'Updates a job position record by its unique ID. ' +
                    'All fields are optional, but unexpected fields will trigger validation errors. ' +
                    'Empty or invalid update payloads will be rejected.',
            }),

            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 2,
                description: 'Unique ID of the job position to update.',
            }),

            ApiBody({
                description:
                    'Job position update payload. Only valid fields from the DTO (`name`, `description`) are allowed.',
                type: UpdateJobPositionDto,
                examples: {
                    valid: {
                        summary: 'Valid Example (Update name only)',
                        value: {
                            name: 'Senior Software Engineer',
                        },
                    },
                    valid_multiple: {
                        summary: 'Valid Example (Update name & description)',
                        value: {
                            name: 'Project Manager',
                            description: 'Responsible for leading development teams and project delivery.',
                        },
                    },
                    invalid_extra_field: {
                        summary: 'Invalid Example (Unexpected property)',
                        description:
                            'Including a field not defined in the DTO, like `title`, triggers validation failure.',
                        value: {
                            title: 'HR Specialist',
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 200,
                description: 'Job position updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Job position updated successfully',
                        data: {
                            id: 2,
                            name: 'Senior Software Engineer',
                            description: 'Develops and maintains high-performance systems.',
                            updatedAt: '2025-11-14T15:22:40.511Z',
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description:
                    'Validation failed — caused by invalid or unexpected properties in request payload.',
                schema: {
                    example: {
                        message: ['property title should not exist'],
                        error: 'Bad Request',
                        statusCode: 400,
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Job position with ID 12 not found.',
                        error: 'Not Found',
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description:
                    'Unexpected server error while attempting to update the job position.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'An unexpected error occurred while updating the job position. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),

    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete a job position',
                description:
                    'Deletes an existing job position from the master database by its numeric ID.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                required: true,
                example: 3,
                description: 'Unique ID of the job position to delete.',
            }),
            ApiResponse({
                status: 200,
                description: 'Job position deleted successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Job position deleted successfully',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
                schema: {
                    example: {
                        statusCode: 404,
                        message: 'Record not found',
                        error: 'Not Found',
                    },
                },
            }),
        ),

    PushToTenants: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Sync job positions with tenant databases',
                description:
                    'Pushes selected job positions from the master database to all active tenant databases. ' +
                    'Useful for ensuring consistent job roles across environments.',
            }),
            ApiBody({
                description: 'List of job position IDs to push to tenants.',
                schema: {
                    example: {
                        jobPositionIds: [1, 2, 3],
                    },
                },
            }),
            ApiResponse({
                status: 200,
                description: 'Job positions successfully pushed to all tenants.',
                schema: {
                    example: {
                        success: true,
                        message: 'Job positions synced to 5 tenants successfully',
                        data: {
                            totalTenantsUpdated: 5,
                            jobPositions: [1, 2, 3],
                        },
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Error during syncing process.',
                schema: {
                    example: {
                        statusCode: 500,
                        message:
                            'An unexpected error occurred while syncing job positions. Please try again later.',
                        error: 'Internal Server Error',
                    },
                },
            }),
        ),
};
