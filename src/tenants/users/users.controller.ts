import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    create(@Req() req, @Body() body: Partial<User>) {
        return this.usersService.create(req, body);
    }

    @Get()
    findAll(@Req() req) {
        return this.usersService.findAll(req);
    }

    @Get(':id')
    findOne(@Req() req, @Param('id') id: number) {
        return this.usersService.findOne(req, id);
    }

    @Put(':id')
    update(@Req() req, @Param('id') id: number, @Body() body: Partial<User>) {
        return this.usersService.update(req, id, body);
    }

    @Delete(':id')
    remove(@Req() req, @Param('id') id: number) {
        return this.usersService.remove(req, id);
    }
}
