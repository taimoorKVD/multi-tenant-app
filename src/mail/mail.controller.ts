import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TestTemplateMailDto } from './dto/test-template-mail.dto';
import { MailService } from './mail.service';

@ApiTags('Email Testing')
@ApiBearerAuth('access-token')
@Controller(['emails', 'tenant/:tenantId/emails'])
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a template-driven test email' })
  @ApiBody({ type: TestTemplateMailDto })
  @ApiResponse({ status: 201, description: 'Email dispatched successfully.' })
  sendTestMail(
    @Req() req: any,
    @Param('tenantId') routeTenantId: string | undefined,
    @Body() dto: TestTemplateMailDto,
  ) {
    return this.mailService.sendTemplateMail(req, {
      ...dto,
      tenantId: dto.tenantId || routeTenantId || req?.tenantId || null,
    });
  }
}