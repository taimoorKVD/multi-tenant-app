import {Body, Controller, Delete, Get, Param, Post, Put, Query,} from '@nestjs/common';
import {RoleService} from './role.service';
import {MasterAccess} from '../../common/decorators';

@Controller('master/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {
  }

  @Get()
  @MasterAccess('view-role')
  async all(@Query('page') page: number = 1) {
    return this.roleService.paginate(page, ['permissions']);
  }

  @Post()
  @MasterAccess('create-role')
  async create(@Body() data: any) {
    return this.roleService.create(data);
  }

  @Get(':id')
  @MasterAccess('view-role')
  async get(@Param('id') id: number) {
    return this.roleService.findOne(id, ['permissions']);
  }

  @Put(':id')
  @MasterAccess('edit-role')
  async update(@Param('id') id: number, @Body() body: any) {
    return this.roleService.update(id, body);
  }

  @Delete(':id')
  @MasterAccess('delete-role')
  async delete(@Param('id') id: number) {
    return this.roleService.delete(id);
  }
}
