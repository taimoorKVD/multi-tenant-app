import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { MasterAccess } from '../../common/decorators';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('master/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @MasterAccess('view-user')
  async all(@Query('page') page: number = 1) {
    return this.usersService.paginate(page);
  }

  @Post()
  @MasterAccess('create-user')
  async create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @Get(':id')
  @MasterAccess('view-user')
  async findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @MasterAccess('edit-user')
  async update(@Param('id') id: number, @Body() body: UpdateUserDto) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  @MasterAccess('delete-user')
  async delete(@Param('id') id: number) {
    return this.usersService.delete(id);
  }
}
