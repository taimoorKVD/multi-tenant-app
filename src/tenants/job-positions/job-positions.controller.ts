import {Body, Controller, Delete, Get, Param, Post, Put, Req} from '@nestjs/common';
import {JobPositionsService} from './job-positions.service';
import {TenantAccess} from "../../common/decorators/tenant-access.decorator";
import {CreateJobPositionDto, UpdateJobPositionDto} from "./dto";

@Controller('tenant/:tenantId/jobpositions')
export class JobPositionController {
    constructor(private readonly jobPositionService: JobPositionsService) {
    }

    @TenantAccess('create-job-position')
    @Post()
    create(@Req() req, @Body() dto: CreateJobPositionDto) {
        return this.jobPositionService.create(req, dto);
    }

    @TenantAccess('view-job-position')
    @Get()
    findAll(@Req() req) {
        return this.jobPositionService.findAll(req);
    }

    @TenantAccess('view-job-position')
    @Get(':id')
    findOne(@Req() req, @Param('id') id: number) {
        return this.jobPositionService.findOne(req, id);
    }

    @TenantAccess('edit-job-position')
    @Put(':id')
    update(@Req() req, @Param('id') id: number, @Body() dto: UpdateJobPositionDto) {
        return this.jobPositionService.update(req, id, dto);
    }

    @TenantAccess('delete-job-position')
    @Delete(':id')
    remove(@Req() req, @Param('id') id: number) {
        return this.jobPositionService.delete(req, id);
    }
}
