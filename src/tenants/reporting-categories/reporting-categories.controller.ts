import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { CreateReportingCategoryDto, UpdateReportingCategoryDto } from './dto';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { ReportingCategoriesService } from './reporting-categories.service';
import { TenantReportingCategoriesSwagger } from './swagger';

@TenantReportingCategoriesSwagger.Tags()
@TenantReportingCategoriesSwagger.Auth()
@Controller(['reporting-categories', 'tenant/:tenantId/reporting-categories'])
export class ReportingCategoriesController {
  constructor(private readonly reportingCategoriesService: ReportingCategoriesService) {}

  @TenantAccess('create-reporting-category')
  @Post()
  @TenantReportingCategoriesSwagger.Create()
  create(@Req() req, @Body() dto: CreateReportingCategoryDto) {
    return this.reportingCategoriesService.create(req, dto);
  }

  @TenantAccess('view-reporting-category')
  @Get()
  @TenantReportingCategoriesSwagger.FindAll()
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.reportingCategoriesService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      [],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-reporting-category')
  @Get('search')
  @TenantReportingCategoriesSwagger.Search()
  search(
    @Req() req,
    @Query('reportingGroupId') reportingGroupId?: number,
    @Query('name') name?: string,
    @Query('description') description?: string,
    @Query('isActive') isActive?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportingCategoriesService.search(req, limit ? Number(limit) : undefined, {
      reportingGroupId,
      name,
      description,
      isActive,
    });
  }

  @TenantAccess('view-reporting-category')
  @Get(':id')
  @TenantReportingCategoriesSwagger.FindOne()
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportingCategoriesService.findOne(req, id);
  }

  @TenantAccess('edit-reporting-category')
  @Put(':id')
  @TenantReportingCategoriesSwagger.Update()
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReportingCategoryDto) {
    return this.reportingCategoriesService.update(req, id, dto);
  }

  @TenantAccess('delete-reporting-category')
  @Delete('bulk')
  @BulkDeleteSwagger('reporting categories')
  bulkRemove(@Req() req, @Body() dto: BulkDeleteDto) {
    return this.reportingCategoriesService.bulkDelete(req, dto.ids);
  }

  @TenantAccess('delete-reporting-category')
  @Delete(':id')
  @TenantReportingCategoriesSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportingCategoriesService.delete(req, id);
  }
}