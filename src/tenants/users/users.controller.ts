import {Body, Controller, Delete, Get, Param, Post, Put, Query, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {CreateUserDto, UpdateUserDto} from './dto';
import {ApiTags} from '@nestjs/swagger';
import {TenantUsersSwagger} from './swagger';

@ApiTags('User Management')
@TenantUsersSwagger.Auth()
@Controller(['users', 'tenant/:tenantId/users'])
export class UsersController {
  constructor(private readonly usersService: UsersService) {
  }

  @TenantAccess('create-user')
  @Post()
  @TenantUsersSwagger.Create()
  create(@Req() req, @Body() dto: CreateUserDto) {
    return this.usersService.create(req, dto);
  }

  @TenantAccess('view-user')
  @Get()
  @TenantUsersSwagger.FindAll()
  findAll(@Req() req) {
    return this.usersService.findAll(req, ['role', 'jobPosition', 'location']);
  }

  @TenantAccess('view-user')
  @Get('search')
  @TenantUsersSwagger.Search()
  search(@Req() req, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.usersService.search(req, q, limit ? Number(limit) : 15);
  }

  @TenantAccess('view-user')
  @Get(':id')
  @TenantUsersSwagger.FindOne()
  findOne(@Req() req, @Param('id') id: number) {
    return this.usersService.findOne(req, id, ['role', 'jobPosition', 'location']);
  }

  @TenantAccess('edit-user')
  @Put(':id')
  @TenantUsersSwagger.Update()
  update(@Req() req, @Param('id') id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req, id, dto);
  }

  @TenantAccess('delete-user')
  @Delete(':id')
  @TenantUsersSwagger.Delete()
  remove(@Req() req, @Param('id') id: number) {
    return this.usersService.delete(req, id);
  }
}
