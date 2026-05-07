import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { encryptMailSecret } from '../../mail/utils/mail-crypto.util';
import { TenantEmailTemplate, TenantMailSetting } from './entities';
import {
  CreateTenantEmailTemplateDto,
  CreateTenantMailSettingDto,
  UpdateTenantEmailTemplateDto,
  UpdateTenantMailSettingDto,
} from './dto';

@Injectable()
export class TenantMailAdminService {
  private getTemplateRepo(req: any): Repository<TenantEmailTemplate> {
    return req.tenantConnection.getRepository(TenantEmailTemplate);
  }

  private getMailSettingRepo(req: any): Repository<TenantMailSetting> {
    return req.tenantConnection.getRepository(TenantMailSetting);
  }

  async listTemplates(req: any, page = 1, limit?: number, module?: string, action?: string) {
    const templateRepo = this.getTemplateRepo(req);
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const qb = templateRepo.createQueryBuilder('template').orderBy('template.id', 'DESC');

    if (take) {
      qb.take(take).skip((currentPage - 1) * take);
    }

    if (module?.trim()) {
      qb.andWhere('LOWER(template.module) = LOWER(:module)', { module: module.trim() });
    }

    if (action?.trim()) {
      qb.andWhere('LOWER(template.action) = LOWER(:action)', { action: action.trim() });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      success: true,
      data,
      meta: {
        total,
        page: currentPage,
        lastPage: take ? Math.max(Math.ceil(total / take), 1) : 1,
      },
    };
  }

  async searchTemplates(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
      module?: string;
      action?: string;
      role?: string;
      status?: string;
      subject?: string;
    },
  ) {
    const templateRepo = this.getTemplateRepo(req);
    const take = Number.isNaN(limit) ? 15 : Math.min(Math.max(limit, 1), 50);
    const name = filters?.name?.trim();
    const module = filters?.module?.trim();
    const action = filters?.action?.trim();
    const role = filters?.role?.trim();
    const status = filters?.status?.trim();
    const subject = filters?.subject?.trim();
    const hasFilters = Boolean(name || module || action || role || status || subject);

    if (!hasFilters) {
      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: 0,
        data: [],
      };
    }

    const qb = templateRepo.createQueryBuilder('template');

    if (name) {
      qb.andWhere('template.name ILIKE :name', { name: `%${name}%` });
    }

    if (module) {
      qb.andWhere('template.module ILIKE :module', { module: `%${module}%` });
    }

    if (action) {
      qb.andWhere('template.action ILIKE :action', { action: `%${action}%` });
    }

    if (role) {
      qb.andWhere('template.role ILIKE :role', { role: `%${role}%` });
    }

    if (status) {
      qb.andWhere('template.status ILIKE :status', { status: `%${status}%` });
    }

    if (subject) {
      qb.andWhere('template.subject ILIKE :subject', { subject: `%${subject}%` });
    }

    const data = await qb.orderBy('template.id', 'DESC').take(take).getMany();
    return {
      success: true,
      tenant: req.tenantConnection.options.database,
      count: data.length,
      data,
    };
  }

  async getTemplate(req: any, id: number) {
    const templateRepo = this.getTemplateRepo(req);
    const template = await templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException('Tenant email template not found.');
    }

    return { success: true, data: template };
  }

  async createTemplate(req: any, dto: CreateTenantEmailTemplateDto) {
    const templateRepo = this.getTemplateRepo(req);
    const entity = templateRepo.create({
      tenantId: req?.tenantId || null,
      masterTemplateId: typeof dto.master_template_id === 'number' ? dto.master_template_id : null,
      name: dto.name.trim(),
      module: dto.module.trim().toLowerCase(),
      action: dto.action.trim().toLowerCase(),
      role: dto.role?.trim().toLowerCase() || null,
      to: dto.to?.trim() || null,
      cc: dto.cc?.trim() || null,
      bcc: dto.bcc?.trim() || null,
      subject: dto.subject.trim(),
      body: dto.body,
      status: dto.status || 'active',
      version: dto.version || 1,
      priority: typeof dto.priority === 'number' ? dto.priority : null,
      isOverride: typeof dto.is_override === 'boolean' ? dto.is_override : true,
    });

    const saved = await templateRepo.save(entity);
    return { success: true, message: 'Tenant email template created successfully.', data: saved };
  }

  async updateTemplate(req: any, id: number, dto: UpdateTenantEmailTemplateDto) {
    const templateRepo = this.getTemplateRepo(req);
    const existing = await templateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tenant email template not found.');
    }

    if (typeof dto.master_template_id === 'number') existing.masterTemplateId = dto.master_template_id;
    if (dto.master_template_id === null) existing.masterTemplateId = null;
    if (typeof dto.name === 'string') existing.name = dto.name.trim();
    if (typeof dto.module === 'string') existing.module = dto.module.trim().toLowerCase();
    if (typeof dto.action === 'string') existing.action = dto.action.trim().toLowerCase();
    if (typeof dto.role === 'string') existing.role = dto.role.trim().toLowerCase();
    if (dto.role === null) existing.role = null;
    if (typeof dto.to === 'string') existing.to = dto.to.trim();
    if (dto.to === null) existing.to = null;
    if (typeof dto.cc === 'string') existing.cc = dto.cc.trim();
    if (dto.cc === null) existing.cc = null;
    if (typeof dto.bcc === 'string') existing.bcc = dto.bcc.trim();
    if (dto.bcc === null) existing.bcc = null;
    if (typeof dto.subject === 'string') existing.subject = dto.subject.trim();
    if (typeof dto.body === 'string') existing.body = dto.body;
    if (typeof dto.status === 'string') existing.status = dto.status;
    if (typeof dto.version === 'number') existing.version = dto.version;
    if (typeof dto.priority === 'number') existing.priority = dto.priority;
    if (typeof dto.is_override === 'boolean') existing.isOverride = dto.is_override;

    const saved = await templateRepo.save(existing);
    return { success: true, message: 'Tenant email template updated successfully.', data: saved };
  }

  async deleteTemplate(req: any, id: number) {
    const templateRepo = this.getTemplateRepo(req);
    const existing = await templateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tenant email template not found.');
    }

    await templateRepo.delete(id);
    return { success: true, message: 'Tenant email template deleted successfully.' };
  }

  async listTenantSmtp(req: any) {
    const mailSettingRepo = this.getMailSettingRepo(req);
    const data = await mailSettingRepo.find({ order: { id: 'DESC' } });
    return {
      success: true,
      count: data.length,
      data: data.map((item) => ({ ...item, encryptedPassword: item.encryptedPassword ? '***' : null })),
    };
  }

  async createTenantSmtp(req: any, dto: CreateTenantMailSettingDto) {
    const mailSettingRepo = this.getMailSettingRepo(req);
    const entity = mailSettingRepo.create({
      tenantId: req?.tenantId || null,
      provider: dto.provider?.trim().toLowerCase() || null,
      host: dto.host.trim(),
      port: dto.port,
      secure: dto.secure,
      username: dto.username?.trim() || null,
      encryptedPassword: encryptMailSecret(dto.password),
      fromEmail: dto.from_email.trim().toLowerCase(),
      fromName: dto.from_name?.trim() || null,
      replyTo: dto.reply_to?.trim().toLowerCase() || null,
      isActive: typeof dto.is_active === 'boolean' ? dto.is_active : true,
      useGlobalFallback:
        typeof dto.use_global_fallback === 'boolean' ? dto.use_global_fallback : true,
    });

    const saved = await mailSettingRepo.save(entity);
    return {
      success: true,
      message: 'Tenant SMTP setting created successfully.',
      data: { ...saved, encryptedPassword: saved.encryptedPassword ? '***' : null },
    };
  }

  async updateTenantSmtp(req: any, id: number, dto: UpdateTenantMailSettingDto) {
    const mailSettingRepo = this.getMailSettingRepo(req);
    const existing = await mailSettingRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tenant SMTP setting not found.');
    }

    if (typeof dto.provider === 'string') existing.provider = dto.provider.trim().toLowerCase();
    if (typeof dto.host === 'string') existing.host = dto.host.trim();
    if (typeof dto.port === 'number') existing.port = dto.port;
    if (typeof dto.secure === 'boolean') existing.secure = dto.secure;
    if (typeof dto.username === 'string') existing.username = dto.username.trim();
    if (typeof dto.password === 'string') existing.encryptedPassword = encryptMailSecret(dto.password);
    if (typeof dto.from_email === 'string') existing.fromEmail = dto.from_email.trim().toLowerCase();
    if (typeof dto.from_name === 'string') existing.fromName = dto.from_name.trim();
    if (typeof dto.reply_to === 'string') existing.replyTo = dto.reply_to.trim().toLowerCase();
    if (typeof dto.is_active === 'boolean') existing.isActive = dto.is_active;
    if (typeof dto.use_global_fallback === 'boolean') {
      existing.useGlobalFallback = dto.use_global_fallback;
    }

    const saved = await mailSettingRepo.save(existing);
    return {
      success: true,
      message: 'Tenant SMTP setting updated successfully.',
      data: { ...saved, encryptedPassword: saved.encryptedPassword ? '***' : null },
    };
  }

  async deleteTenantSmtp(req: any, id: number) {
    const mailSettingRepo = this.getMailSettingRepo(req);
    const existing = await mailSettingRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tenant SMTP setting not found.');
    }

    await mailSettingRepo.delete(id);
    return { success: true, message: 'Tenant SMTP setting deleted successfully.' };
  }
}
