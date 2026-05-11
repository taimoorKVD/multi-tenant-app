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
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.vendorsService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      ['contacts', 'orderDeadlines'],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-vendor')
  @Get('search')
  @TenantVendorsSwagger.Search()
  search(
    @Req() req,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('username') username?: string,
    @Query('phone_number') phoneNumber?: string,
    @Query('country_id') countryId?: string,
    @Query('state_id') stateId?: string,
    @Query('city_id') cityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.vendorsService.search(req, limit ? Number(limit) : undefined, {
      name,
      email,
      username,
      phoneNumber,
      countryId: countryId ? Number(countryId) : undefined,
      stateId: stateId ? Number(stateId) : undefined,
      cityId: cityId ? Number(cityId) : undefined,
    });
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
