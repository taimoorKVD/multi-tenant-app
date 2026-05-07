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

    Search: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Search master job positions',
                description: 'Filters master job positions using explicit field-by-field filters.',
            }),
            ApiQuery({
                name: 'name',
                required: false,
                type: String,
                example: 'Engineer',
                description: 'Filter by job position name.',
            }),
            ApiQuery({
                name: 'description',
                required: false,
                type: String,
                example: 'operations',
                description: 'Filter by description.',
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
                description: 'Matching job positions fetched successfully.',
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
                    'Pushes selected job positions from the master database to the specified tenant databases. '
                    + 'Creates missing job positions and ensures consistent data across tenants.',
            }),
            ApiBody({
                description: 'Provide job position IDs and tenant IDs to sync.',
                schema: {
                    example: {
                        jobPositionIds: [1, 2, 3],
                        tenantIds: [1, 2, 9]
                    },
                },
            }),
            ApiResponse({
                status: 200,
                description: 'Job positions successfully processed for selected tenants.',
                schema: {
                    example: {
                        status: true,
                        message: "Job positions successfully processed for selected tenants.",
                        summary: {
                            totalJobPositions: 3,
                            totalTenantsSelected: 3,
                            totalTenantsProcessed: 2,
                            missingTenants: [9],
                            statusBreakdown: {
                                successCount: 1,
                                failedCount: 1
                            }
                        },
                        results: [
                            {
                                tenant: "Travel Agency International",
                                status: "success",
                                message: "Synced successfully. 2 created, 1 already existed.",
                                createdCount: 2,
                                existedCount: 1,
                                error: null
                            },
                            {
                                tenant: "Core 2 Plus",
                                status: "error",
                                message: "Sync failed: No metadata found for job positions in this tenant database.",
                                createdCount: 0,
                                existedCount: 0,
                                error: "No metadata for 'JobPosition' was found."
                            }
                        ]
                    },
                },
            }),
            ApiResponse({
                status: 500,
                description: 'Unexpected server error.',
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
