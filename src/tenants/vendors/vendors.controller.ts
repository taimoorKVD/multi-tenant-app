import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { VendorsService } from './vendors.service';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { TenantVendorsSwagger } from './swagger';

@TenantVendorsSwagger.Tags()
@TenantVendorsSwagger.Auth()
@Controller(['vendors', 'tenant/:tenantId/vendors'])
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @TenantAccess('create-vendor')
  @Post()
  @TenantVendorsSwagger.Create()
  create(@Req() req, @Body() body: any) {
    return this.vendorsService.create(req, body);
  }

  @TenantAccess('view-vendor')
  @Get()
  @TenantVendorsSwagger.FindAll()
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.vendorsService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      [],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-vendor')
  @Get('search')
  @TenantVendorsSwagger.Search()
  search(@Req() req, @Query() query: Record<string, any>) {
    const limit = query?.limit !== undefined ? Number(query.limit) : undefined;
    const { limit: _limit, ...filters } = query || {};
    return this.vendorsService.search(req, Number.isFinite(limit) ? limit : undefined, filters);
  }

  @TenantAccess('view-vendor')
  @Get(':id')
  @TenantVendorsSwagger.FindOne()
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.vendorsService.findOne(req, id);
  }

  @TenantAccess('edit-vendor')
  @Put(':id')
  @TenantVendorsSwagger.Update()
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.vendorsService.update(req, id, body);
  }

  @TenantAccess('delete-vendor')
  @Delete('bulk')
  @BulkDeleteSwagger('vendors')
  bulkRemove(@Req() req, @Body() dto: BulkDeleteDto) {
    return this.vendorsService.bulkDelete(req, dto.ids);
  }

  @TenantAccess('delete-vendor')
  @Delete(':id')
  @TenantVendorsSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.vendorsService.delete(req, id);
  }
}
