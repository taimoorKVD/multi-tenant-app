import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import { CreateItemDto, UpdateItemDto } from './dto';
import { ItemsService } from './items.service';
import { TenantItemsSwagger } from './swagger';

@TenantItemsSwagger.Tags()
@TenantItemsSwagger.Auth()
@Controller(['items', 'tenant/:tenantId/items'])
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @TenantAccess('create-item')
  @Post()
  @TenantItemsSwagger.Create()
  create(@Req() req, @Body() dto: CreateItemDto) {
    return this.itemsService.create(req, dto);
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
  search(@Req() req, @Query('name') name?: string, @Query('limit') limit?: string) {
    return this.itemsService.search(req, limit ? Number(limit) : undefined, { name });
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
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    return this.itemsService.update(req, id, dto);
  }

  @TenantAccess('delete-item')
  @Delete(':id')
  @TenantItemsSwagger.Delete()
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.itemsService.delete(req, id);
  }
}