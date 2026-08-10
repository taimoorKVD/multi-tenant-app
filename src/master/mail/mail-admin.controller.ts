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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MasterAccess } from '../../common/decorators';
import { BulkDeleteDto } from '../../common/dto';
import { BulkDeleteSwagger } from '../../common/swagger';
import { MailAdminService } from './mail-admin.service';
import {
  CreateEmailTemplateDto,
  CreateEmailTemplateRecipientDto,
  CreateGlobalMailSettingDto,
  UpdateEmailTemplateDto,
  UpdateEmailTemplateRecipientDto,
  UpdateGlobalMailSettingDto,
} from './dto';
import { QueueService } from '../../queue/queue.service';
import { EmailWorker } from '../../queue/email.worker';

@ApiTags('Email Management')
@ApiBearerAuth('access-token')
@Controller('master/mail')
export class MailAdminController {
  constructor(
    private readonly mailAdminService: MailAdminService,
    private readonly queueService: QueueService,
    private readonly emailWorker: EmailWorker,
  ) {}

  @Get('templates')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'List master email templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  listTemplates(
    @Query('page') page = 1,
    @Query('limit') limit?: number,
    @Query('module') module?: string,
    @Query('action') action?: string,
  ) {
    return this.mailAdminService.listTemplates(
      Number(page),
      limit !== undefined ? Number(limit) : undefined,
      module,
      action,
    );
  }

  @Get('templates/search')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'Search master email templates' })
  @ApiQuery({ name: 'name', required: false, type: String })
  @ApiQuery({ name: 'module', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'subject', required: false, type: String })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of records to return (1-50). Default is 15.',
  })
  searchTemplates(
    @Query('name') name?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('subject') subject?: string,
    @Query('limit') limit?: number,
  ) {
    return this.mailAdminService.searchTemplates(
      limit !== undefined ? Number(limit) : undefined,
      {
        name,
        module,
        action,
        role,
        status,
        subject,
      },
    );
  }

  @Get('templates/:id')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'Get one master email template' })
  getTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.mailAdminService.getTemplate(id);
  }

  @Post('templates')
  @MasterAccess('create-tenant')
  @ApiOperation({ summary: 'Create master email template' })
  createTemplate(@Body() dto: CreateEmailTemplateDto) {
    return this.mailAdminService.createTemplate(dto);
  }

  @Patch('templates/:id')
  @MasterAccess('edit-tenant')
  @ApiOperation({ summary: 'Update master email template' })
  updateTemplate(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmailTemplateDto) {
    return this.mailAdminService.updateTemplate(id, dto);
  }

  @Delete('templates/bulk')
  @MasterAccess('delete-tenant')
  @BulkDeleteSwagger('email templates')
  bulkDeleteTemplates(@Body() dto: BulkDeleteDto) {
    return this.mailAdminService.bulkDeleteTemplates(dto.ids);
  }

  @Delete('templates/:id')
  @MasterAccess('delete-tenant')
  @ApiOperation({ summary: 'Delete master email template' })
  deleteTemplate(@Param('id', ParseIntPipe) id: number) {
    return this.mailAdminService.deleteTemplate(id);
  }

  @Get('templates/:templateId/recipients')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'List recipient rules of a template' })
  listRecipients(@Param('templateId', ParseIntPipe) templateId: number) {
    return this.mailAdminService.listRecipients(templateId);
  }

  @Post('templates/:templateId/recipients')
  @MasterAccess('create-tenant')
  @ApiOperation({ summary: 'Create recipient rule for template' })
  createRecipient(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreateEmailTemplateRecipientDto,
  ) {
    return this.mailAdminService.addRecipient(templateId, dto);
  }

  @Patch('templates/:templateId/recipients/:recipientId')
  @MasterAccess('edit-tenant')
  @ApiOperation({ summary: 'Update recipient rule for template' })
  updateRecipient(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('recipientId', ParseIntPipe) recipientId: number,
    @Body() dto: UpdateEmailTemplateRecipientDto,
  ) {
    return this.mailAdminService.updateRecipient(templateId, recipientId, dto);
  }

  @Delete('templates/:templateId/recipients/:recipientId')
  @MasterAccess('delete-tenant')
  @ApiOperation({ summary: 'Delete recipient rule for template' })
  deleteRecipient(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('recipientId', ParseIntPipe) recipientId: number,
  ) {
    return this.mailAdminService.removeRecipient(templateId, recipientId);
  }

  @Get('smtp/global')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'List global SMTP settings' })
  listGlobalSmtp() {
    return this.mailAdminService.listGlobalMailSettings();
  }

  @Post('smtp/global')
  @MasterAccess('create-tenant')
  @ApiOperation({ summary: 'Create global SMTP settings record' })
  createGlobalSmtp(@Body() dto: CreateGlobalMailSettingDto) {
    return this.mailAdminService.createGlobalMailSetting(dto);
  }

  @Patch('smtp/global/:id')
  @MasterAccess('edit-tenant')
  @ApiOperation({ summary: 'Update global SMTP settings record' })
  updateGlobalSmtp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGlobalMailSettingDto,
  ) {
    return this.mailAdminService.updateGlobalMailSetting(id, dto);
  }

  @Delete('smtp/global/bulk')
  @MasterAccess('delete-tenant')
  @BulkDeleteSwagger('global SMTP settings')
  bulkDeleteGlobalSmtp(@Body() dto: BulkDeleteDto) {
    return this.mailAdminService.bulkDeleteGlobalMailSettings(dto.ids);
  }

  @Delete('smtp/global/:id')
  @MasterAccess('delete-tenant')
  @ApiOperation({ summary: 'Delete global SMTP settings record' })
  deleteGlobalSmtp(@Param('id', ParseIntPipe) id: number) {
    return this.mailAdminService.deleteGlobalMailSetting(id);
  }

  @Get('queue/health')
  @MasterAccess('view-tenant')
  @ApiOperation({ summary: 'Queue worker health and queue stats' })
  async queueHealth() {
    const queueStats = await this.queueService.getHealth();
    return {
      success: true,
      worker: this.emailWorker.getStatus(),
      queue: queueStats,
      timestamp: new Date().toISOString(),
    };
  }
}