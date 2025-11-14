import {ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse} from '@nestjs/swagger';
import {applyDecorators} from '@nestjs/common';
import {CreateRoleDto, UpdateRoleDto} from '../dto';

export const RoleSwagger = {
    Auth: () => ApiBearerAuth('access-token'),

    GetAll: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get all roles (paginated)',
                description:
                    'Retrieves a paginated list of roles along with their associated permissions.',
            }),
            ApiQuery({
                name: 'page',
                required: false,
                example: 1,
                description: 'Page number for pagination (default = 1)',
            }),
            ApiResponse({
                status: 200,
                description: 'Paginated list of roles retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        data: [
                            {
                                id: 1,
                                name: 'Super Admin',
                                createdAt: '2025-11-06T15:04:48.818Z',
                                updatedAt: '2025-11-06T15:04:48.818Z',
                                permissions: [
                                    {id: 1, name: 'create-user'},
                                    {id: 2, name: 'view-user'},
                                    {id: 3, name: 'edit-user'},
                                ],
                            },
                            {
                                id: 2,
                                name: 'Admin',
                                createdAt: '2025-11-06T15:04:48.818Z',
                                updatedAt: '2025-11-06T15:04:48.818Z',
                                permissions: [
                                    {id: 2, name: 'view-user'},
                                    {id: 6, name: 'view-role'},
                                ],
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
        ),

    Create: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Create a new role',
                description:
                    'Creates a new role and optionally assigns permissions to it.',
            }),
            ApiBody({
                description: 'Role creation payload',
                type: CreateRoleDto,
                examples: {
                    valid: {
                        summary: 'Example request',
                        value: {
                            name: 'Supervisor',
                            permissions: [1, 2, 3],
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 201,
                description: 'Role created successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Role created successfully',
                        data: {
                            id: 3,
                            name: 'Supervisor',
                            createdAt: '2025-11-14T11:37:55.553Z',
                            updatedAt: '2025-11-14T11:37:55.553Z',
                            permissions: [
                                {id: 1, name: 'create-user'},
                                {id: 2, name: 'view-user'},
                                {id: 3, name: 'edit-user'},
                            ],
                        },
                    },
                },
            }),
            ApiResponse({
                status: 400,
                description: 'Validation error or duplicate role name.',
                schema: {
                    example: {
                        success: false,
                        message: 'Role with this name already exists',
                        statusCode: 400,
                    },
                },
            }),
        ),

    GetOne: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Get role by ID',
                description:
                    'Fetches a single role by its ID, including all linked permissions.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 1,
                description: 'Unique identifier of the role',
            }),
            ApiResponse({
                status: 200,
                description: 'Role details retrieved successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record fetched successfully',
                        data: {
                            id: 1,
                            name: 'Super Admin',
                            createdAt: '2025-11-06T15:04:48.818Z',
                            updatedAt: '2025-11-06T15:04:48.818Z',
                            permissions: [
                                {id: 1, name: 'create-user'},
                                {id: 2, name: 'view-user'},
                                {id: 3, name: 'edit-user'},
                                {id: 4, name: 'delete-user'},
                                {id: 5, name: 'create-role'},
                                {id: 6, name: 'view-role'},
                                {id: 7, name: 'edit-role'},
                            ],
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Role not found.',
                schema: {
                    example: {
                        success: false,
                        message: 'Role not found',
                        statusCode: 404,
                    },
                },
            }),
        ),

    Update: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Update a role',
                description:
                    'Updates an existing role and its assigned permissions. Returns the updated role object.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 3,
                description: 'ID of the role to update',
            }),
            ApiBody({
                description: 'Updated role payload',
                type: UpdateRoleDto,
                examples: {
                    valid: {
                        summary: 'Example update payload',
                        value: {
                            name: 'Manager',
                            permissions: [1, 4, 6],
                        },
                    },
                },
            } as any),
            ApiResponse({
                status: 200,
                description: 'Role updated successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Role updated successfully',
                        data: {
                            id: 3,
                            name: 'Manager',
                            createdAt: '2025-11-14T11:37:55.553Z',
                            updatedAt: '2025-11-14T11:42:45.511Z',
                            permissions: [
                                {id: 1, name: 'create-user'},
                                {id: 4, name: 'delete-user'},
                                {id: 6, name: 'view-role'},
                            ],
                        },
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Role not found.',
                schema: {
                    example: {
                        success: false,
                        message: 'Role not found',
                        statusCode: 404,
                    },
                },
            }),
        ),


    Delete: () =>
        applyDecorators(
            ApiOperation({
                summary: 'Delete a role',
                description:
                    'Deletes a role by ID. Returns confirmation of successful deletion.',
            }),
            ApiParam({
                name: 'id',
                type: Number,
                example: 3,
                description: 'ID of the role to delete',
            }),
            ApiResponse({
                status: 200,
                description: 'Role deleted successfully.',
                schema: {
                    example: {
                        success: true,
                        message: 'Record deleted successfully',
                    },
                },
            }),
            ApiResponse({
                status: 404,
                description: 'Role not found.',
                schema: {
                    example: {
                        success: false,
                        message: 'Role not found',
                        statusCode: 404,
                    },
                },
            }),
        ),

};
