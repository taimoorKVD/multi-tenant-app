import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * Get paginated roles
   */
  @Get()
  @TenantAccess('view-role')
  async all(@Req() req, @Query('page') page: number = 1) {
    try {
      return await this.roleService.paginate(req, +page, ['permissions']);
    } catch (error) {
      console.error('❌ Failed to fetch roles:', error);
      throw new InternalServerErrorException('Failed to fetch roles');
    }
  }

  /**
   * Create new role
   */
  @Post()
  @TenantAccess('create-role')
  async create(@Req() req, @Body('name') name: string, @Body('permissions') ids: number[]) {
    try {
      const data = {
        name,
        permissions: ids?.map((id) => ({ id })) || [],
      };

      const result = await this.roleService.create(req, data);
      return {
        ...result,
        message: 'Role created successfully',
      };
    } catch (error) {
      console.error('❌ Role creation failed:', error);
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  /**
   * Get single role by ID
   */
  @Get(':id')
  @TenantAccess('view-role')
  async get(@Req() req, @Param('id') id: number) {
    try {
      const result = await this.roleService.findOne(req, +id, ['permissions']);
      if (!result?.data) throw new NotFoundException('Role not found');
      return result;
    } catch (error) {
      console.error('❌ Fetch role failed:', error);
      throw error instanceof NotFoundException
        ? error
        : new InternalServerErrorException('Failed to retrieve role');
    }
  }

  /**
   * Update existing role
   */
  @Put(':id')
  @TenantAccess('edit-role')
  async update(
    @Req() req,
    @Param('id') id: number,
    @Body('name') name: string,
    @Body('permissions') ids: number[],
  ) {
    try {
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
    } catch (error) {
      console.error('❌ Role update failed:', error);
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  /**
   * Delete role by ID
   */
  @Delete(':id')
  @TenantAccess('delete-role')
  async delete(@Req() req, @Param('id') id: number) {
    try {
      return await this.roleService.delete(req, +id);
    } catch (error) {
      console.error('❌ Role deletion failed:', error);
      throw new InternalServerErrorException('Failed to delete role');
    }
  }
}
