import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req} from '@nestjs/common';
import {JobPositionsService} from './job-positions.service';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";
import {CreateJobPositionDto, UpdateJobPositionDto} from "./dto";
import {TenantJobPositionsSwagger} from './swagger';
import { JobPosition } from './entities';

@TenantJobPositionsSwagger.Tags()
@TenantJobPositionsSwagger.Auth()
@Controller(['jobpositions', 'tenant/:tenantId/jobpositions'])
export class JobPositionController {
    constructor(private readonly jobPositionService: JobPositionsService) {
    }

    @TenantAccess('create-job-position')
    @Post()
    @TenantJobPositionsSwagger.Create()
    create(@Req() req, @Body() dto: CreateJobPositionDto) {
        return this.jobPositionService.create(req, dto);
    }

    @TenantAccess('view-job-position')
    @Get()
    @TenantJobPositionsSwagger.FindAll()
    findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
        const parsedPage = Number(page);
        const parsedLimit = limit === undefined ? undefined : Number(limit);

        return this.jobPositionService.paginate(
            req,
            Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
            ['permissions'],
            Number.isFinite(parsedLimit) ? parsedLimit : undefined,
        );
    }

    @TenantAccess('view-job-position')
    @Get('search')
    @TenantJobPositionsSwagger.Search()
    search(
        @Req() req,
        @Query('name') name?: string,
        @Query('description') description?: string,
        @Query('permission_id') permissionId?: string,
        @Query('limit') limit?: string,
    ) {
        return this.jobPositionService.search(req, limit ? Number(limit) : undefined, {
            name,
            description,
            permissionId: permissionId ? Number(permissionId) : undefined,
        });
    }

    @TenantAccess('view-job-position')
    @Get(':id')
    @TenantJobPositionsSwagger.FindOne()
    findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.jobPositionService.findOne(req, id);
    }

    @TenantAccess('edit-job-position')
    @Put(':id')
    @TenantJobPositionsSwagger.Update()
    update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobPositionDto) {
        return this.jobPositionService.update(req, id, dto);
    }

    @TenantAccess('delete-job-position')
    @Delete(':id')
    @TenantJobPositionsSwagger.Delete()
    remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
        return this.jobPositionService.delete(req, id);
    }
}
