import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { ItemsService } from './items.service';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { TenantItemsSwagger } from './swagger';

@TenantItemsSwagger.Tags()
@TenantItemsSwagger.Auth()
@Controller(['items', 'tenant/:tenantId/items'])
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @TenantAccess('create-item')
  @Post()
  @TenantItemsSwagger.Create()
  create(@Req() req, @Body() body: any) {
    return this.itemsService.create(req, body);
  }

  @TenantAccess('view-item')
  @Get()
  @TenantItemsSwagger.FindAll()
  findAll(@Req() req, @Query('page') page?: number, @Query('limit') limit?: number) {
    const parsedPage = Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);

    return this.itemsService.paginate(
      req,
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      [],
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  @TenantAccess('view-item')
  @Get('search')
  @TenantItemsSwagger.Search()
  search(@Req() req, @Query() query: Record<string, any>) {
    const limit = query?.limit !== undefined ? Number(query.limit) : undefined;
    const { limit: _limit, ...filters } = query || {};
    return this.itemsService.search(req, Number.isFinite(limit) ? limit : undefined, filters);
  }

  @TenantAccess('view-item')
  @Get(':id')
  @TenantItemsSwagger.FindOne()
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.itemsService.findOne(req, id);
  }

  @TenantAccess('edit-item')
  @Put(':id')
  @TenantItemsSwagger.Update()
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.itemsService.update(req, id, body);
  }

  @TenantAccess('delete-item')
  @Delete('bulk')
  @BulkDeleteSwagger('items')
  bulkRemove(@Req() req, @Body() dto: BulkDeleteDto) {
    return this.itemsService.bulkDelete(req, dto.ids);
  }

  @TenantAccess('delete-item')
  @Delete(':id')
  @TenantItemsSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.itemsService.delete(req, id);
  }
}