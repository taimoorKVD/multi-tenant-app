import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { MasterAccess } from '../../common/decorators';

@Controller('master/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    @MasterAccess('view-users')
    async all(@Query('page') page: number = 1) {
        return this.usersService.paginate(page);
    }

    @Post()
    @MasterAccess('manage-tenants')
    async create(@Body() body: any) {
        return this.usersService.create(body);
    }

    @Get(':id')
    @MasterAccess('view-users')
    async findOne(@Param('id') id: number) {
        return this.usersService.findOne(id);
    }

    @Put(':id')
    @MasterAccess('manage-tenants')
    async update(@Param('id') id: number, @Body() body: any) {
        return this.usersService.update(id, body);
    }

    @Delete(':id')
    @MasterAccess('manage-tenants')
    async delete(@Param('id') id: number) {
        return this.usersService.delete(id);
    }
}
