import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query,} from '@nestjs/common';
import {RoleService} from './role.service';
import {MasterAccess} from '../../common/decorators';
import {CreateRoleDto, UpdateRoleDto} from './dto';
import {Role} from './entities';
import {ApiResponse} from 'src/common/abstract';
import {ApiTags} from "@nestjs/swagger";
import {RoleSwagger} from './swagger';

@ApiTags('Role Management')
@RoleSwagger.Auth()
@Controller('master/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {
  }

  // Get paginated roles
  @Get()
  @MasterAccess('view-role')
  @RoleSwagger.GetAll()
  async all(@Query('page') page: number = 1, @Query('limit') limit?: number) {
    return this.roleService.paginate(
      page,
      ['permissions'],
      limit !== undefined ? Number(limit) : undefined,
    );
  }

  // Create new role
  @Post()
  @MasterAccess('create-role')
  @RoleSwagger.Create()
  async create(@Body() dto: CreateRoleDto): Promise<ApiResponse<Role>> {
    return this.roleService.create(dto as any);
  }

  // Get single role by ID
  @Get(':id')
  @RoleSwagger.GetOne()
  @MasterAccess('view-role')
  async get(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findOne(id, ['permissions']);
  }

  // Update role
  @Put(':id')
  @MasterAccess('edit-role')
  @RoleSwagger.Update()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ): Promise<ApiResponse<Role>> {
    return this.roleService.update(id, dto as any);
  }

  // Delete role
  @Delete(':id')
  @MasterAccess('delete-role')
  @RoleSwagger.Delete()
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.delete(id);
  }
}
