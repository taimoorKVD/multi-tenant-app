import {applyDecorators} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CreatePermissionDto, UpdatePermissionDto } from '../dto';

export const PermissionSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    GetAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get all permissions grouped by module',
                description:
                    'Retrieves permissions grouped under their module. Each group contains the module display name and its permission actions.',
            }),
            ApiResponse({
                status: 200,
                description: 'Permissions retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            {
                                module: { name: 'User' },
                                permissions: [
                                    { id: 1, name: 'Create' },
                                    { id: 2, name: 'View' },
                                ],
                            },
                            {
                                module: { name: 'Form' },
                                permissions: [
                                    { id: 33, name: 'View' },
                                    { id: 37, name: 'Create' },
                                ],
                            },
                            {
                                module: { name: 'Template' },
                                permissions: [
                                    { id: 39, name: 'Create' },
                                    { id: 52, name: 'Archive' },
                                ],
                            },
                        ],
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
                name: 'module',
                required: false,
                type: String,
                example: 'users',
                description: 'Filter by module name.',
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

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create master permission',
                description: 'Creates a new permission in the master workspace.',
            }),
            ApiBody({
                description: 'Permission creation payload',
                type: CreatePermissionDto,
                examples: {
                    valid: {
                        summary: 'Create permission request',
                        value: {
                            name: 'approve-user',
                            module: { name: 'users' },
                        },
                    },
                },
            } as any),
            ApiResponse({ status: 201, description: 'Permission created successfully.' }),
            ApiResponse({ status: 400, description: 'Validation failed or duplicate permission name.' }),
        ),

    GetOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get permission by ID',
                description: 'Fetches a single permission by ID from master workspace.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Permission ID',
            }),
            ApiResponse({ status: 200, description: 'Permission fetched successfully.' }),
            ApiResponse({ status: 404, description: 'Permission not found.' }),
        ),

    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update master permission',
                description: 'Updates an existing master permission by ID.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Permission ID',
            }),
            ApiBody({
                description: 'Permission update payload',
                type: UpdatePermissionDto,
                examples: {
                    valid: {
                        summary: 'Update permission request',
                        value: {
                            name: 'approve-user-request',
                            module: { name: 'users' },
                        },
                    },
                },
            } as any),
            ApiResponse({ status: 200, description: 'Permission updated successfully.' }),
            ApiResponse({ status: 404, description: 'Permission not found.' }),
        ),

    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete master permission',
                description: 'Deletes a master permission by ID.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Permission ID',
            }),
            ApiResponse({ status: 200, description: 'Permission deleted successfully.' }),
            ApiResponse({ status: 404, description: 'Permission not found.' }),
        ),
};
