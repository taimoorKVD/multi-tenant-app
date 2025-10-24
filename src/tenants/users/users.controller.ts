import {Body, Controller, Delete, Get, Param, Post, Put, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {User} from './entities';
import {Permissions} from "../../common/decorators";

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {
    }

    @Permissions('create-user')
    @Post()
    create(@Req() req, @Body() body: Partial<User>) {
        return this.usersService.create(req, body);
    }

    @Permissions('view-user')
    @Get()
    findAll(@Req() req) {
        return this.usersService.findAll(req);
    }

    @Permissions('view-user')
    @Get(':id')
    findOne(@Req() req, @Param('id') id: number) {
        return this.usersService.findOne(req, id);
    }

    @Permissions('edit-user')
    @Put(':id')
    update(@Req() req, @Param('id') id: number, @Body() body: Partial<User>) {
        return this.usersService.update(req, id, body);
    }

    @Permissions('delete-user')
    @Delete(':id')
    remove(@Req() req, @Param('id') id: number) {
        return this.usersService.delete(req, id);
    }
}
