import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req} from '@nestjs/common';
import {LocationsService} from './locations.service';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";
import {CreateLocationDto, UpdateLocationDto} from "./dto";
import {TenantLocationsSwagger} from './swagger';

@TenantLocationsSwagger.Tags()
@TenantLocationsSwagger.Auth()
@Controller(['locations', 'tenant/:tenantId/locations'])
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) {
    }

    @TenantAccess('create-location')
    @Post()
    @TenantLocationsSwagger.Create()
    create(@Req() req, @Body() dto: CreateLocationDto) {
        return this.locationsService.create(req, dto);
    }

    @TenantAccess('view-location')
    @Get()
    @TenantLocationsSwagger.FindAll()
    findAll(@Req() req) {
        return this.locationsService.findAll(req);
    }

    @TenantAccess('view-location')
    @Get('search')
    @TenantLocationsSwagger.Search()
    search(@Req() req, @Query('q') q: string, @Query('limit') limit?: string) {
        return this.locationsService.search(req, q, limit ? Number(limit) : 15);
    }

    @TenantAccess('view-location')
    @Get(':id')
    @TenantLocationsSwagger.FindOne()
    findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.locationsService.findOne(req, id);
    }

    @TenantAccess('edit-location')
    @Put(':id')
    @TenantLocationsSwagger.Update()
    update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLocationDto) {
        return this.locationsService.update(req, id, dto);
    }

    @TenantAccess('delete-location')
    @Delete(':id')
    @TenantLocationsSwagger.Delete()
    remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.locationsService.delete(req, id);
    }
}
