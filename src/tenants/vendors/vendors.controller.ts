import {Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req} from '@nestjs/common';
import {VendorsService} from './vendors.service';
import {TenantAccess} from '../../common/decorators/tenant-access.decorator';
import {CreateVendorDto, UpdateVendorDto} from './dto';
import {TenantVendorsSwagger} from './swagger';

@TenantVendorsSwagger.Tags()
@TenantVendorsSwagger.Auth()
@Controller(['vendors', 'tenant/:tenantId/vendors'])
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {
  }

  @TenantAccess('create-vendor')
  @Post()
  @TenantVendorsSwagger.Create()
  create(@Req() req, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(req, dto);
  }

  @TenantAccess('view-vendor')
  @Get()
  @TenantVendorsSwagger.FindAll()
  findAll(@Req() req) {
    return this.vendorsService.findAll(req);
  }

  @TenantAccess('view-vendor')
  @Get('search')
  @TenantVendorsSwagger.Search()
  search(@Req() req, @Query('q') q: string, @Query('limit') limit?: string) {
    return this.vendorsService.search(req, q, limit ? Number(limit) : 15);
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
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(req, id, dto);
  }

  @TenantAccess('delete-vendor')
  @Delete(':id')
  @TenantVendorsSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.vendorsService.delete(req, id);
  }
}
