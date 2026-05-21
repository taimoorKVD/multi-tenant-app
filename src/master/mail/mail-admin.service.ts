import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate, EmailTemplateRecipient, GlobalMailSetting } from './entities';
import {
  CreateEmailTemplateDto,
  CreateEmailTemplateRecipientDto,
  CreateGlobalMailSettingDto,
  UpdateEmailTemplateDto,
  UpdateEmailTemplateRecipientDto,
  UpdateGlobalMailSettingDto,
} from './dto';
import { encryptMailSecret } from '../../mail/utils/mail-crypto.util';

@Injectable()
export class MailAdminService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(EmailTemplateRecipient)
    private readonly recipientRepo: Repository<EmailTemplateRecipient>,
    @InjectRepository(GlobalMailSetting)
    private readonly globalMailRepo: Repository<GlobalMailSetting>,
  ) {}

  async listTemplates(page = 1, limit?: number, module?: string, action?: string) {
    const parsedLimit = Number(limit);
    const take =
      limit === undefined
        ? undefined
        : parsedLimit <= 0
          ? undefined
          : Math.min(Math.max(parsedLimit, 1), 100);
    const currentPage = Math.max(Number(page) || 1, 1);
    const qb = this.templateRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.recipients', 'recipient')
      .orderBy('template.id', 'DESC');

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
    const parsedLimit = Number(limit);
    const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
    const name = filters?.name?.trim();
    const module = filters?.module?.trim();
    const action = filters?.action?.trim();
    const role = filters?.role?.trim();
    const status = filters?.status?.trim();
    const subject = filters?.subject?.trim();
    const hasFilters = Boolean(name || module || action || role || status || subject);

    if (!hasFilters) {
      return {success: true, count: 0, data: []};
    }

    const qb = this.templateRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.recipients', 'recipient');

    if (name) {
      qb.andWhere('template.name ILIKE :name', {name: `%${name}%`});
    }

    if (module) {
      qb.andWhere('template.module ILIKE :module', {module: `%${module}%`});
    }

    if (action) {
      qb.andWhere('template.action ILIKE :action', {action: `%${action}%`});
    }

    if (role) {
      qb.andWhere('template.role ILIKE :role', {role: `%${role}%`});
    }

    if (status) {
      qb.andWhere('template.status ILIKE :status', {status: `%${status}%`});
    }

    if (subject) {
      qb.andWhere('template.subject ILIKE :subject', {subject: `%${subject}%`});
    }

    const data = await qb.orderBy('template.id', 'DESC').take(take).getMany();
    return {success: true, count: data.length, data};
  }

  async getTemplate(id: number) {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['recipients'],
    });

    if (!template) {
      throw new NotFoundException('Email template not found.');
    }

    return { success: true, data: template };
  }

  async createTemplate(dto: CreateEmailTemplateDto) {
    const entity = this.templateRepo.create({
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
      isOverride: Boolean(dto.is_override),
      tenantId: null,
    });

    const saved = await this.templateRepo.save(entity);
    return { success: true, message: 'Email template created successfully.', data: saved };
  }

  async updateTemplate(id: number, dto: UpdateEmailTemplateDto) {
    const existing = await this.templateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Email template not found.');
    }

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

    const saved = await this.templateRepo.save(existing);
    return { success: true, message: 'Email template updated successfully.', data: saved };
  }

  async deleteTemplate(id: number) {
    const existing = await this.templateRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Email template not found.');
    }

    await this.templateRepo.delete(id);
    return { success: true, message: 'Email template deleted successfully.' };
  }

  async listRecipients(templateId: number) {
    await this.getTemplate(templateId);
    const data = await this.recipientRepo.find({
      where: { templateId },
      order: { id: 'DESC' },
    });
    return { success: true, count: data.length, data };
  }

  async addRecipient(templateId: number, dto: CreateEmailTemplateRecipientDto) {
    await this.getTemplate(templateId);

    const entity = this.recipientRepo.create({
      templateId,
      channel: dto.channel,
      sourceType: dto.source_type,
      value: dto.value.trim(),
    });

    const saved = await this.recipientRepo.save(entity);
    return { success: true, message: 'Recipient rule created successfully.', data: saved };
  }

  async updateRecipient(templateId: number, recipientId: number, dto: UpdateEmailTemplateRecipientDto) {
    await this.getTemplate(templateId);
    const existing = await this.recipientRepo.findOne({ where: { id: recipientId, templateId } });
    if (!existing) {
      throw new NotFoundException('Recipient rule not found.');
    }

    if (dto.channel) existing.channel = dto.channel;
    if (dto.source_type) existing.sourceType = dto.source_type;
    if (typeof dto.value === 'string') existing.value = dto.value.trim();

    const saved = await this.recipientRepo.save(existing);
    return { success: true, message: 'Recipient rule updated successfully.', data: saved };
  }

  async removeRecipient(templateId: number, recipientId: number) {
    await this.getTemplate(templateId);
    const existing = await this.recipientRepo.findOne({ where: { id: recipientId, templateId } });
    if (!existing) {
      throw new NotFoundException('Recipient rule not found.');
    }

    await this.recipientRepo.delete(recipientId);
    return { success: true, message: 'Recipient rule deleted successfully.' };
  }

  async listGlobalMailSettings() {
    const data = await this.globalMailRepo.find({ order: { id: 'DESC' } });
    return {
      success: true,
      count: data.length,
      data: data.map((item) => ({ ...item, encryptedPassword: item.encryptedPassword ? '***' : null })),
    };
  }

  async createGlobalMailSetting(dto: CreateGlobalMailSettingDto) {
    const entity = this.globalMailRepo.create({
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
    });

    const saved = await this.globalMailRepo.save(entity);
    return {
      success: true,
      message: 'Global SMTP setting created successfully.',
      data: { ...saved, encryptedPassword: saved.encryptedPassword ? '***' : null },
    };
  }

  async updateGlobalMailSetting(id: number, dto: UpdateGlobalMailSettingDto) {
    const existing = await this.globalMailRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Global SMTP setting not found.');
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

    const saved = await this.globalMailRepo.save(existing);
    return {
      success: true,
      message: 'Global SMTP setting updated successfully.',
      data: { ...saved, encryptedPassword: saved.encryptedPassword ? '***' : null },
    };
  }

  async deleteGlobalMailSetting(id: number) {
    const existing = await this.globalMailRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Global SMTP setting not found.');
    }

    await this.globalMailRepo.delete(id);
    return { success: true, message: 'Global SMTP setting deleted successfully.' };
  }
}
