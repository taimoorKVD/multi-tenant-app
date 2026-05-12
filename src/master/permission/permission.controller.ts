import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { MasterAccess } from '../../common/decorators';
import { ApiTags } from '@nestjs/swagger';
import { PermissionSwagger } from './swagger';
import { CreatePermissionDto, UpdatePermissionDto } from './dto/index';
import { ApiResponse } from '../../common/abstract';
import { Permission } from './entities';

@ApiTags('Permission Management')
@PermissionSwagger.Auth()
@Controller('master/permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @MasterAccess('view-permission')
  @PermissionSwagger.GetAll()
  async all(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.permissionService.paginate(page, [], limit !== undefined ? Number(limit) : undefined);
  }

  @Get('search')
  @MasterAccess('view-permission')
  @PermissionSwagger.Search()
  async search(@Query('name') name?: string, @Query('limit') limit?: string) {
    return this.permissionService.search(limit ? Number(limit) : undefined, {name});
  }

  @Post()
  @MasterAccess('create-permission')
  @PermissionSwagger.Create()
  async create(@Body() dto: CreatePermissionDto): Promise<ApiResponse<Permission>> {
    return this.permissionService.create(dto as any);
  }

  @Get(':id')
  @MasterAccess('view-permission')
  @PermissionSwagger.GetOne()
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.permissionService.findOne(id);
  }

  @Put(':id')
  @MasterAccess('edit-permission')
  @PermissionSwagger.Update()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionDto,
  ): Promise<ApiResponse<Permission>> {
    return this.permissionService.update(id, dto as any);
  }

  @Delete(':id')
  @MasterAccess('delete-permission')
  @PermissionSwagger.Delete()
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.permissionService.delete(id);
  }
}
