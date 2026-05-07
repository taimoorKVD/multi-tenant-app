import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {RoleService} from './role.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {ApiTags} from '@nestjs/swagger';
import {TenantRoleSwagger} from './swagger';

@ApiTags('Role Management')
@TenantRoleSwagger.Auth()
@Controller(['roles', 'tenant/:tenantId/roles'])
export class RoleController {
  constructor(private readonly roleService: RoleService) {
  }

  /**
   * Get paginated roles
   */
  @Get()
  @TenantAccess('view-role')
  @TenantRoleSwagger.FindAll()
  async all(@Req() req, @Query('page') page: number = 1, @Query('limit') limit?: number) {
    return await this.roleService.paginate(
      req,
      +page,
      ['permissions'],
      limit !== undefined ? Number(limit) : undefined,
    );
  }

  /**
   * Create new role
   */
  @Post()
  @TenantAccess('create-role')
  @TenantRoleSwagger.Create()
  async create(@Req() req, @Body('name') name: string, @Body('permissions') ids: number[]) {
    const data = {
      name,
      permissions: ids?.map((id) => ({ id })) || [],
    };

    const result = await this.roleService.create(req, data);
    return {
      ...result,
      message: 'Role created successfully',
    };
  }

  @Get('search')
  @TenantAccess('view-role')
  @TenantRoleSwagger.Search()
  async search(
    @Req() req,
    @Query('name') name?: string,
    @Query('permission_id') permissionId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roleService.search(req, limit ? Number(limit) : undefined, {
      name,
      permissionId: permissionId ? Number(permissionId) : undefined,
    });
  }

  /**
   * Get single role by ID
   */
  @Get(':id')
  @TenantAccess('view-role')
  @TenantRoleSwagger.FindOne()
  async get(@Req() req, @Param('id') id: number) {
    const result = await this.roleService.findOne(req, +id, ['permissions']);
    if (!result?.data) throw new NotFoundException('Role not found');
    return result;
  }

  /**
   * Update existing role
   */
  @Put(':id')
  @TenantAccess('edit-role')
  @TenantRoleSwagger.Update()
  async update(
    @Req() req,
    @Param('id') id: number,
    @Body('name') name: string,
    @Body('permissions') ids: number[],
  ) {
    // Update role name
    await this.roleService.update(req, +id, { name });

    // Re-fetch the updated role
    const roleData = await this.roleService.findOne(req, +id);
    const role = roleData?.data;

    // Update permissions by recreating relationship
    const updateData = {
      ...role,
      permissions: ids?.map((pid) => ({ id: pid })) || [],
    };

    const updated = await this.roleService.create(req, updateData);
    return {
      ...updated,
      message: 'Role updated successfully',
    };
  }

  /**
   * Delete role by ID
   */
  @Delete(':id')
  @TenantAccess('delete-role')
  @TenantRoleSwagger.Delete()
  async delete(@Req() req, @Param('id') id: number) {
    return await this.roleService.delete(req, +id);
  }
}