import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TenantAccess } from '../../common/decorators/tenant-access.decorator';
import {
  CreateTenantEmailTemplateDto,
  CreateTenantMailSettingDto,
  UpdateTenantEmailTemplateDto,
  UpdateTenantMailSettingDto,
} from './dto';
import { TenantMailAdminService } from './tenant-mail-admin.service';

@ApiTags('Email Management')
@ApiBearerAuth('access-token')
@Controller(['mail', 'tenant/:tenantId/mail'])
export class TenantMailAdminController {
  constructor(private readonly tenantMailAdminService: TenantMailAdminService) {}

  @Get('templates')
  @TenantAccess()
  @ApiOperation({ summary: 'List tenant email templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  listTemplates(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit?: number,
    @Query('module') module?: string,
    @Query('action') action?: string,
  ) {
    return this.tenantMailAdminService.listTemplates(
      req,
      Number(page),
      limit !== undefined ? Number(limit) : undefined,
      module,
      action,
    );
  }

  @Get('templates/:id')
  @TenantAccess()
  @ApiOperation({ summary: 'Get one tenant email template' })
  getTemplate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.tenantMailAdminService.getTemplate(req, id);
  }

  @Post('templates')
  @TenantAccess()
  @ApiOperation({ summary: 'Create tenant email template' })
  createTemplate(@Req() req: any, @Body() dto: CreateTenantEmailTemplateDto) {
    return this.tenantMailAdminService.createTemplate(req, dto);
  }

  @Patch('templates/:id')
  @TenantAccess()
  @ApiOperation({ summary: 'Update tenant email template' })
  updateTemplate(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantEmailTemplateDto,
  ) {
    return this.tenantMailAdminService.updateTemplate(req, id, dto);
  }

  @Delete('templates/:id')
  @TenantAccess()
  @ApiOperation({ summary: 'Delete tenant email template' })
  deleteTemplate(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.tenantMailAdminService.deleteTemplate(req, id);
  }

  @Get('smtp')
  @TenantAccess()
  @ApiOperation({ summary: 'List tenant SMTP settings' })
  listTenantSmtp(@Req() req: any) {
    return this.tenantMailAdminService.listTenantSmtp(req);
  }

  @Post('smtp')
  @TenantAccess()
  @ApiOperation({ summary: 'Create tenant SMTP settings record' })
  createTenantSmtp(@Req() req: any, @Body() dto: CreateTenantMailSettingDto) {
    return this.tenantMailAdminService.createTenantSmtp(req, dto);
  }

  @Patch('smtp/:id')
  @TenantAccess()
  @ApiOperation({ summary: 'Update tenant SMTP settings record' })
  updateTenantSmtp(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantMailSettingDto,
  ) {
    return this.tenantMailAdminService.updateTenantSmtp(req, id, dto);
  }

  @Delete('smtp/:id')
  @TenantAccess()
  @ApiOperation({ summary: 'Delete tenant SMTP settings record' })
  deleteTenantSmtp(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.tenantMailAdminService.deleteTenantSmtp(req, id);
  }
}
