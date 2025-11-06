import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('tenant/:tenantId/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @TenantAccess('create-user')
  @Post()
  create(@Req() req, @Body() dto: CreateUserDto) {
    return this.usersService.create(req, dto);
  }

  @TenantAccess('view-user')
  @Get()
  findAll(@Req() req) {
    return this.usersService.findAll(req);
  }

  @TenantAccess('view-user')
  @Get(':id')
  findOne(@Req() req, @Param('id') id: number) {
    return this.usersService.findOne(req, id);
  }

  @TenantAccess('edit-user')
  @Put(':id')
  update(@Req() req, @Param('id') id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req, id, dto);
  }

  @TenantAccess('delete-user')
  @Delete(':id')
  remove(@Req() req, @Param('id') id: number) {
    return this.usersService.delete(req, id);
  }
}
