import {Body, Controller, Delete, Get, Param, Post, Put, Query, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {CreateUserDto, SendUserCredentialsDto, UpdateUserDto} from './dto';
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
  search(
    @Req() req,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('username') username?: string,
    @Query('phone_number') phoneNumber?: string,
    @Query('role_id') roleId?: string,
    @Query('job_position_id') jobPositionId?: string,
    @Query('location_id') locationId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.search(req, limit ? Number(limit) : undefined, {
      name,
      email,
      username,
      phoneNumber,
      roleId: roleId ? Number(roleId) : undefined,
      jobPositionId: jobPositionId ? Number(jobPositionId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
    });
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

  @TenantAccess('edit-user')
  @Post(':id/send-credentials')
  @TenantUsersSwagger.SendCredentials()
  sendCredentials(@Req() req, @Param('id') id: number, @Body() dto: SendUserCredentialsDto) {
    return this.usersService.sendCredentials(req, id, dto);
  }
}
