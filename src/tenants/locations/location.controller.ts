import {Body, Controller, Delete, Get, Param, Post, Put, Req} from '@nestjs/common';
import {LocationsService} from './locations.service';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";
import {CreateLocationDto, UpdateLocationDto} from "./dto";

@Controller('tenant/:tenantId/locations')
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) {
    }

    @TenantAccess('create-location')
    @Post()
    create(@Req() req, @Body() dto: CreateLocationDto) {
        return this.locationsService.create(req, dto);
    }

    @TenantAccess('view-location')
    @Get()
    findAll(@Req() req) {
        return this.locationsService.findAll(req);
    }

    @TenantAccess('view-location')
    @Get(':id')
    findOne(@Req() req, @Param('id') id: number) {
        return this.locationsService.findOne(req, id);
    }

    @TenantAccess('edit-location')
    @Put(':id')
    update(@Req() req, @Param('id') id: number, @Body() dto: UpdateLocationDto) {
        return this.locationsService.update(req, id, dto);
    }

    @TenantAccess('delete-location')
    @Delete(':id')
    remove(@Req() req, @Param('id') id: number) {
        return this.locationsService.delete(req, id);
    }
}
