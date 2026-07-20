import { Controller, Get, Param, ParseIntPipe, Post, Query, Req } from '@nestjs/common';
import { TenantAccess } from '../../../common/decorators/tenant-access.decorator';
import { TemplateVersionsService } from '../services';
import { QueryTemplateVersionDto } from '../dto';
import { TenantDataCollectionTemplateVersionsSwagger } from '../swagger/template-versions.swagger';

@TenantDataCollectionTemplateVersionsSwagger.Tags()
@TenantDataCollectionTemplateVersionsSwagger.Auth()
@Controller(['data-collection/templates/:templateId/versions', 'tenant/:tenantId/data-collection/templates/:templateId/versions'])
export class TemplateVersionsController {
  constructor(private readonly templateVersionsService: TemplateVersionsService) {}

  @Get()
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplateVersionsSwagger.FindAll()
  findAll(
    @Req() req: any,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Query() query: QueryTemplateVersionDto,
  ) {
    return this.templateVersionsService.findAll(req, templateId, query);
  }

  @Get('active')
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplateVersionsSwagger.FindActive()
  findActive(@Req() req: any, @Param('templateId', ParseIntPipe) templateId: number) {
    return this.templateVersionsService.findActive(req, templateId);
  }

  @Get(':id')
  @TenantAccess('view-dc-template')
  @TenantDataCollectionTemplateVersionsSwagger.FindOne()
  findOne(
    @Req() req: any,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.templateVersionsService.findOne(req, templateId, id);
  }

  @Post('restore/:versionNumber')
  @TenantAccess('edit-dc-template')
  @TenantDataCollectionTemplateVersionsSwagger.Restore()
  restore(
    @Req() req: any,
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ) {
    return this.templateVersionsService.restore(req, templateId, versionNumber);
  }
}
