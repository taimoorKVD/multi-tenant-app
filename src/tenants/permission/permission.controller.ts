import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {PermissionService} from './permission.service';
import {ApiTags} from '@nestjs/swagger';
import {TenantPermissionSwagger} from './swagger';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/index';

@ApiTags('Permission Management')
@TenantPermissionSwagger.Auth()
@Controller(['permissions', 'tenant/:tenantId/permissions'])
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {
  }

  /**
   * Get all permissions for a tenant
   */
  @Get()
  @TenantAccess('view-permission')
  @TenantPermissionSwagger.FindAll()
  async all(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    try {
      const parsedPage = Number(page);
      const parsedLimit = limit === undefined ? undefined : Number(limit);
      const result = await this.permissionService.paginate(
        req,
        Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
        [],
        Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      );
      return {
        ...result,
        message: 'Permissions fetched successfully',
      };
    } catch (error) {
      console.error('❌ Failed to fetch permissions:', error);
      throw new InternalServerErrorException('Failed to fetch permissions');
    }
  }

  @Get('search')
  @TenantAccess('view-permission')
  @TenantPermissionSwagger.Search()
  async search(
    @Req() req,
    @Query('name') name?: string,
    @Query('limit') limit?: string,
  ) {
    return this.permissionService.search(req, limit ? Number(limit) : undefined, {
      name,
    });
  }

  @Post()
  @TenantAccess('create-permission')
  @TenantPermissionSwagger.Create()
  async create(@Req() req, @Body() dto: CreatePermissionDto) {
    return this.permissionService.create(req, dto as any);
  }

  @Get(':id')
  @TenantAccess('view-permission')
  @TenantPermissionSwagger.FindOne()
  async get(@Req() req, @Param('id') id: number) {
    return this.permissionService.findOne(req, +id);
  }

  @Put(':id')
  @TenantAccess('edit-permission')
  @TenantPermissionSwagger.Update()
  async update(
    @Req() req,
    @Param('id') id: number,
    @Body() dto: UpdatePermissionDto,
  ) {
    return this.permissionService.update(req, +id, dto as any);
  }

  @Delete(':id')
  @TenantAccess('delete-permission')
  @TenantPermissionSwagger.Delete()
  async delete(@Req() req, @Param('id') id: number) {
    return this.permissionService.delete(req, +id);
  }
}
