import {applyDecorators} from '@nestjs/common';
import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags} from '@nestjs/swagger';
import {CreateJobPositionDto, UpdateJobPositionDto} from '../dto';

export const TenantJobPositionsSwagger = {
    Tags: () => ApiTags('Job Position Management'),
    Auth: () => ApiBearerAuth('access-token'),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create tenant job position',
                description:
                    'Creates a job position for the current tenant, including optional description and permission mapping.',
            }),
            ApiParam({
                name: 'tenantId',
                required: true,
                example: 'kingdomvision',
                description: 'Tenant slug. Required when using `/tenant/{tenantId}/jobpositions` route.',
            }),
            ApiBody({
                type: CreateJobPositionDto,
                examples: {
                    valid: {
                        summary: 'Create job position',
                        value: {
                            name: 'Shift Manager',
                            description: 'Supervises day-to-day floor operations.',
                            permissionIds: [1, 2, 5],
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 201,
                description: 'Job position created successfully.',
            }),
            ApiResponse({
                status: 400,
                description: 'Validation failed or duplicate name / invalid permission IDs.',
            }),
        ),

    FindAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'List tenant job positions',
                description: 'Returns all job positions for the current tenant with related permissions.',
            }),
            ApiParam({
                name: 'tenantId',
                required: true,
                example: 'kingdomvision',
                description: 'Tenant slug. Required when using `/tenant/{tenantId}/jobpositions` route.',
            }),
            ApiResponse({
                status: 200,
                description: 'Job positions fetched successfully.',
            }),
        ),

    FindOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get tenant job position by ID',
                description: 'Fetches one tenant job position by numeric ID with related permissions.',
            }),
            ApiParam({
                name: 'tenantId',
                required: true,
                example: 'kingdomvision',
                description: 'Tenant slug. Required when using `/tenant/{tenantId}/jobpositions/{id}` route.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Job position ID.',
            }),
            ApiResponse({
                status: 200,
                description: 'Job position fetched successfully.',
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
            }),
        ),

    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update tenant job position',
                description: 'Updates tenant job position fields and permission assignments.',
            }),
            ApiParam({
                name: 'tenantId',
                required: true,
                example: 'kingdomvision',
                description: 'Tenant slug. Required when using `/tenant/{tenantId}/jobpositions/{id}` route.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Job position ID.',
            }),
            ApiBody({
                type: UpdateJobPositionDto,
                examples: {
                    valid: {
                        summary: 'Update job position',
                        value: {
                            name: 'Senior Shift Manager',
                            description: 'Leads shift operations and coaching.',
                            permissionIds: [1, 4, 6],
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 200,
                description: 'Job position updated successfully.',
            }),
            ApiResponse({
                status: 400,
                description: 'Validation failed or invalid permission IDs.',
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
            }),
        ),

    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete tenant job position',
                description: 'Deletes a tenant job position by ID.',
            }),
            ApiParam({
                name: 'tenantId',
                required: true,
                example: 'kingdomvision',
                description: 'Tenant slug. Required when using `/tenant/{tenantId}/jobpositions/{id}` route.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Job position ID.',
            }),
            ApiResponse({
                status: 200,
                description: 'Job position deleted successfully.',
            }),
            ApiResponse({
                status: 404,
                description: 'Job position not found.',
            }),
        ),
};
