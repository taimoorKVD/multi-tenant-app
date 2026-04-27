import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmailTemplate, EmailTemplateRecipient } from '../master/mail/entities';
import { TenantEmailTemplate } from '../tenants/mail/entities';
import { TenantsService } from '../master/tenants/tenants.service';
import { EMAIL_TEMPLATE_STATUS } from '../mail/constants/mail.constants';

interface EffectiveTemplateOptions {
  module: string;
  action: string;
  role?: string | null;
  tenantId?: string | null;
  req?: any;
}

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly emailTemplateRepo: Repository<EmailTemplate>,
    private readonly tenantsService: TenantsService,
  ) {}

  private normalizeRole(role?: string | null): string | null {
    const value = role?.trim().toLowerCase();
    return value || null;
  }

  private async getTenantConnection(req?: any, tenantId?: string | null): Promise<DataSource | null> {
    if (req?.tenantConnection) {
      return req.tenantConnection as DataSource;
    }

    if (!tenantId) {
      return null;
    }

    return this.tenantsService.getTenantConnection(tenantId);
  }

  private async findMasterTemplate(
    module: string,
    action: string,
    role?: string | null,
  ): Promise<EmailTemplate | null> {
    const normalizedRole = this.normalizeRole(role);
    const qb = this.emailTemplateRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.recipients', 'recipient')
      .where('LOWER(template.module) = LOWER(:module)', { module })
      .andWhere('LOWER(template.action) = LOWER(:action)', { action })
      .andWhere('template.status = :status', { status: EMAIL_TEMPLATE_STATUS.ACTIVE })
      .orderBy(
        normalizedRole
          ? 'CASE WHEN LOWER(template.role) = LOWER(:role) THEN 0 WHEN template.role IS NULL THEN 1 ELSE 2 END'
          : 'CASE WHEN template.role IS NULL THEN 0 ELSE 1 END',
        'ASC',
      )
      .addOrderBy('template.version', 'DESC');

    if (normalizedRole) {
      qb.setParameter('role', normalizedRole);
      qb.andWhere('(LOWER(template.role) = LOWER(:role) OR template.role IS NULL)');
    } else {
      qb.andWhere('template.role IS NULL');
    }

    return qb.getOne();
  }

  private async findTenantTemplate(
    tenantConnection: DataSource,
    module: string,
    action: string,
    role?: string | null,
  ): Promise<TenantEmailTemplate | null> {
    const repo = tenantConnection.getRepository(TenantEmailTemplate);
    const normalizedRole = this.normalizeRole(role);
    const qb = repo
      .createQueryBuilder('template')
      .where('LOWER(template.module) = LOWER(:module)', { module })
      .andWhere('LOWER(template.action) = LOWER(:action)', { action })
      .andWhere('template.status = :status', { status: EMAIL_TEMPLATE_STATUS.ACTIVE })
      .andWhere('template.is_override = true')
      .orderBy(
        normalizedRole
          ? 'CASE WHEN LOWER(template.role) = LOWER(:role) THEN 0 WHEN template.role IS NULL THEN 1 ELSE 2 END'
          : 'CASE WHEN template.role IS NULL THEN 0 ELSE 1 END',
        'ASC',
      )
      .addOrderBy('template.version', 'DESC');

    if (normalizedRole) {
      qb.setParameter('role', normalizedRole);
      qb.andWhere('(LOWER(template.role) = LOWER(:role) OR template.role IS NULL)');
    } else {
      qb.andWhere('template.role IS NULL');
    }

    return qb.getOne();
  }

  async getEffectiveTemplate(options: EffectiveTemplateOptions) {
    const tenantConnection = await this.getTenantConnection(options.req, options.tenantId);
    const masterTemplate = await this.findMasterTemplate(
      options.module,
      options.action,
      options.role,
    );

    if (!masterTemplate) {
      throw new NotFoundException(
        `No active email template found for ${options.module}/${options.action}.`,
      );
    }

    const tenantTemplate = tenantConnection
      ? await this.findTenantTemplate(tenantConnection, options.module, options.action, options.role)
      : null;

    const effectiveTemplate = tenantTemplate
      ? {
          id: tenantTemplate.masterTemplateId ?? masterTemplate.id,
          name: tenantTemplate.name || masterTemplate.name,
          module: tenantTemplate.module,
          action: tenantTemplate.action,
          role: tenantTemplate.role,
          to: tenantTemplate.to ?? masterTemplate.to,
          cc: tenantTemplate.cc ?? masterTemplate.cc,
          bcc: tenantTemplate.bcc ?? masterTemplate.bcc,
          subject: tenantTemplate.subject || masterTemplate.subject,
          body: tenantTemplate.body || masterTemplate.body,
          status: tenantTemplate.status,
          version: tenantTemplate.version || masterTemplate.version,
          priority: tenantTemplate.priority ?? masterTemplate.priority,
          tenantId: options.tenantId ?? tenantTemplate.tenantId ?? null,
          isOverride: true,
          recipients: masterTemplate.recipients || ([] as EmailTemplateRecipient[]),
        }
      : masterTemplate;

    return {
      tenantConnection,
      masterTemplate,
      tenantTemplate,
      template: effectiveTemplate,
    };
  }
}