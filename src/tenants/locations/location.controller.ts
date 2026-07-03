import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req} from '@nestjs/common';
import {LocationsService} from './locations.service';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";
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
    create(@Req() req, @Body() body: any) {
        return this.locationsService.create(req, body);
    }

    @TenantAccess('view-location')
    @Get()
    @TenantLocationsSwagger.FindAll()
    findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
        const parsedPage = Number(page);
        const parsedLimit = limit === undefined ? undefined : Number(limit);

        return this.locationsService.paginate(
            req,
            Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
            [],
            Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        );
    }

    @TenantAccess('view-location')
    @Get('search')
    @TenantLocationsSwagger.Search()
    search(@Req() req, @Query() query: Record<string, any>) {
        const limit = query?.limit !== undefined ? Number(query.limit) : undefined;
        const { limit: _limit, ...filters } = query || {};
        return this.locationsService.search(req, Number.isFinite(limit) ? limit : undefined, filters);
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
    update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
        return this.locationsService.update(req, id, body);
    }

    @TenantAccess('delete-location')
    @Delete(':id')
    @TenantLocationsSwagger.Delete()
    remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.locationsService.delete(req, id);
    }
}
