import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { TemplatesService } from '../services';
import { CreateTemplateDto, UpdateTemplateDto, QueryTemplateDto } from '../dto';
import { TenantDataCollectionTemplatesSwagger } from '../swagger/templates.swagger';

@TenantDataCollectionTemplatesSwagger.Tags()
@TenantDataCollectionTemplatesSwagger.Auth()
@Controller(['data-collection/templates', 'tenant/:tenantId/data-collection/templates'])
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @TenantAccess('create-dc-template')
  @TenantDataCollectionTemplatesSwagger.Create()
  create(@Req() req: any, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(req, dto);
  }

  @Get()
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplatesSwagger.FindAll()
  findAll(@Req() req: any, @Query() query: QueryTemplateDto) {
    return this.templatesService.findAll(req, query);
  }

  @Get('search')
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplatesSwagger.Search()
  search(@Req() req: any, @Query() query: Record<string, any>) {
    const limit = query?.limit !== undefined ? Number(query.limit) : undefined;
    const { limit: _limit, ...filters } = query || {};
    return this.templatesService.search(req, Number.isFinite(limit) ? limit : undefined, filters);
  }

  @Get(':id')
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplatesSwagger.FindOne()
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.templatesService.findOne(req, id);
  }

  @Put(':id')
  @TenantAccess('edit-dc-template')
  @TenantDataCollectionTemplatesSwagger.Update()
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(req, id, dto);
  }

  @Delete(':id')
  @TenantAccess('delete-dc-template')
  @TenantDataCollectionTemplatesSwagger.Delete()
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.templatesService.remove(req, id);
  }

  @Post(':id/activate')
  @TenantAccess('activate-dc-template')
  @TenantDataCollectionTemplatesSwagger.Activate()
  activate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.templatesService.activate(req, id);
  }

  @Post(':id/archive')
  @TenantAccess('archive-dc-template')
  @TenantDataCollectionTemplatesSwagger.Archive()
  archive(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.templatesService.archive(req, id);
  }

}
