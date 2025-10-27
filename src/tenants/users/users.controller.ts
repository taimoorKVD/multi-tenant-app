import {Body, Controller, Delete, Get, Param, Post, Put, Req} from '@nestjs/common';
import {UsersService} from './users.service';
import {User} from './entities';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";

@Controller('tenant/:tenantId/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {
    }

    @TenantAccess('create-user')
    @Post()
    create(@Req() req, @Body() body: Partial<User>) {
        return this.usersService.create(req, body);
    }

    @TenantAccess('view-user1')
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
    update(@Req() req, @Param('id') id: number, @Body() body: Partial<User>) {
        return this.usersService.update(req, id, body);
    }

    @TenantAccess('delete-user')
    @Delete(':id')
    remove(@Req() req, @Param('id') id: number) {
        return this.usersService.delete(req, id);
    }
}
