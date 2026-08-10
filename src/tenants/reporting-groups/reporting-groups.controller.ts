import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { CreateReportingGroupDto, UpdateReportingGroupDto } from './dto';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { ReportingGroupsService } from './reporting-groups.service';
import { TenantReportingGroupsSwagger } from './swagger';

@TenantReportingGroupsSwagger.Tags()
@TenantReportingGroupsSwagger.Auth()
@Controller(['reporting-groups', 'tenant/:tenantId/reporting-groups'])
export class ReportingGroupsController {
  constructor(private readonly reportingGroupsService: ReportingGroupsService) {}

  @TenantAccess('create-reporting-group')
  @Post()
  @TenantReportingGroupsSwagger.Create()
  create(@Req() req, @Body() dto: CreateReportingGroupDto) {
    return this.reportingGroupsService.create(req, dto);
  }

  @TenantAccess('view-reporting-group')
  @Get()
  @TenantReportingGroupsSwagger.FindAll()
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.reportingGroupsService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      [],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-reporting-group')
  @Get('search')
  @TenantReportingGroupsSwagger.Search()
  search(
    @Req() req,
    @Query('name') name?: string,
    @Query('description') description?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportingGroupsService.search(req, limit ? Number(limit) : undefined, {
      name,
      description,
      isActive: typeof isActive === 'string' ? isActive === 'true' : undefined,
    });
  }

  @TenantAccess('view-reporting-group')
  @Get(':id')
  @TenantReportingGroupsSwagger.FindOne()
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportingGroupsService.findOne(req, id);
  }

  @TenantAccess('edit-reporting-group')
  @Put(':id')
  @TenantReportingGroupsSwagger.Update()
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReportingGroupDto) {
    return this.reportingGroupsService.update(req, id, dto);
  }

  @TenantAccess('delete-reporting-group')
  @Delete('bulk')
  @BulkDeleteSwagger('reporting groups')
  bulkRemove(@Req() req, @Body() dto: BulkDeleteDto) {
    return this.reportingGroupsService.bulkDelete(req, dto.ids);
  }

  @TenantAccess('delete-reporting-group')
  @Delete(':id')
  @TenantReportingGroupsSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportingGroupsService.delete(req, id);
  }
}