import {Body, Controller, Delete, Get, Param, Post, Put} from '@nestjs/common';
import {TenantsService} from './tenants.service';
import {Tenant} from "./entities";
import {CreateTenantDto} from "./dto";

@Controller('tenants')
export class TenantsController {
    constructor(private readonly tenantsService: TenantsService) {
    }

    @Get()
    async findAll() {
        return this.tenantsService.findAll();
    }

    @Post()
    async create(@Body() dto: CreateTenantDto) {
        return this.tenantsService.create(dto);
    }

    @Delete(':id')
    async remove(@Param('id') id: number) {
        return this.tenantsService.remove(id);
    }

    @Put(':id')
    async update(@Param('id') id: number, @Body() body: Partial<Tenant>) {
        return this.tenantsService.update(id, body);
    }
}
