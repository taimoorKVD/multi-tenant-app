import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { EmailLog, GlobalMailSetting } from '../master/mail/entities';
import { TemplateService } from '../template/template.service';
import { QueueService } from '../queue/queue.service';
import { EmailDispatchService } from '../queue/email-dispatch.service';
import {
  EMAIL_LOG_STATUS,
  EMAIL_RECIPIENT_CHANNEL,
  EMAIL_RECIPIENT_SOURCE,
} from './constants/mail.constants';
import { EmailJobPayload, MailSmtpConfig } from './interfaces/mail-job.interface';
import { SendTemplateMailOptions, SendTemplateMailResult } from './interfaces/send-template-mail.interface';
import {
  BaseEmailResolver,
  EmailTemplateResolver,
  OrderEmailResolver,
  UserEmailResolver,
} from './resolvers';
import {
  assertTemplateVariables,
  normalizeEmailList,
  renderTemplate,
} from './utils/template-variable.util';
import { decryptMailSecret } from './utils/mail-crypto.util';
import { TenantMailSetting } from '../tenants/mail/entities';
import { User } from '../tenants/users/entities';

@Injectable()
export class MailService {
  private readonly resolvers: EmailTemplateResolver[];

  constructor(
    private readonly templateService: TemplateService,
    private readonly queueService: QueueService,
    private readonly emailDispatchService: EmailDispatchService,
    @InjectRepository(EmailLog)
    private readonly emailLogRepo: Repository<EmailLog>,
    @InjectRepository(GlobalMailSetting)
    private readonly globalMailSettingRepo: Repository<GlobalMailSetting>,
    private readonly baseEmailResolver: BaseEmailResolver,
    private readonly userEmailResolver: UserEmailResolver,
    private readonly orderEmailResolver: OrderEmailResolver,
  ) {
    this.resolvers = [baseEmailResolver, userEmailResolver, orderEmailResolver];
  }

  private getResolver(module: string): EmailTemplateResolver {
    return this.resolvers.find((resolver) => resolver.supports(module)) || this.baseEmailResolver;
  }

  private buildIdempotencyKey(options: {
    module: string;
    action: string;
    tenantId?: string | null;
    templateId: number;
    version: number;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body: string;
    explicitKey?: string | null;
  }): string {
    if (options.explicitKey?.trim()) {
      return options.explicitKey.trim();
    }

    return createHash('sha256')
      .update(
        JSON.stringify({
          module: options.module,
          action: options.action,
          tenantId: options.tenantId || null,
          templateId: options.templateId,
          version: options.version,
          to: options.to,
          cc: options.cc,
          bcc: options.bcc,
          subject: options.subject,
          body: options.body,
        }),
      )
      .digest('hex');
  }

  private async resolveRecipientRule(
    tenantConnection: DataSource | null,
    sourceType: string,
    value: string,
    data: Record<string, unknown>,
  ): Promise<string[]> {
    switch (sourceType) {
      case EMAIL_RECIPIENT_SOURCE.STATIC:
        return normalizeEmailList(value);
      case EMAIL_RECIPIENT_SOURCE.PLACEHOLDER:
        return normalizeEmailList(renderTemplate(value, data, { escape: false }));
      case EMAIL_RECIPIENT_SOURCE.USER: {
        if (!tenantConnection) {
          return [];
        }

        const userRepo = tenantConnection.getRepository(User);
        const numericId = Number(value);
        const user = Number.isInteger(numericId) && numericId > 0
          ? await userRepo.findOne({ where: { id: numericId } })
          : await userRepo.findOne({ where: { email: value } });

        return user?.email ? [user.email.toLowerCase()] : [];
      }
      case EMAIL_RECIPIENT_SOURCE.ROLE: {
        if (!tenantConnection) {
          return [];
        }

        const userRepo = tenantConnection.getRepository(User);
        const numericId = Number(value);
        const users = await userRepo.find({
          where: Number.isInteger(numericId) && numericId > 0
            ? ({ role: { id: numericId } } as any)
            : ({ role: { name: value } } as any),
          relations: ['role'],
        });

        return users.map((user) => user.email.toLowerCase());
      }
      default:
        return [];
    }
  }

  private async resolveRecipients(
    tenantConnection: DataSource | null,
    template: any,
    options: SendTemplateMailOptions,
    data: Record<string, unknown>,
  ) {
    const channels = {
      to: normalizeEmailList(renderTemplate(Array.isArray(options.to) ? options.to.join(',') : options.to || template.to || '', data, { escape: false })),
      cc: normalizeEmailList(renderTemplate(Array.isArray(options.cc) ? options.cc.join(',') : options.cc || template.cc || '', data, { escape: false })),
      bcc: normalizeEmailList(renderTemplate(Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc || template.bcc || '', data, { escape: false })),
    };

    if (Array.isArray(template.recipients)) {
      for (const recipientRule of template.recipients) {
        const resolved = await this.resolveRecipientRule(
          tenantConnection,
          recipientRule.sourceType,
          recipientRule.value,
          data,
        );

        if (recipientRule.channel === EMAIL_RECIPIENT_CHANNEL.CC) {
          channels.cc = Array.from(new Set([...channels.cc, ...resolved]));
          continue;
        }

        if (recipientRule.channel === EMAIL_RECIPIENT_CHANNEL.BCC) {
          channels.bcc = Array.from(new Set([...channels.bcc, ...resolved]));
          continue;
        }

        channels.to = Array.from(new Set([...channels.to, ...resolved]));
      }
    }

    if (!channels.to.length) {
      throw new BadRequestException('Email recipient resolution produced no "to" addresses.');
    }

    return channels;
  }

  private getEnvValue(...keys: string[]): string | null {
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) {
        return value;
      }
    }

    return null;
  }

  private async loadSmtpConfig(tenantConnection: DataSource | null): Promise<MailSmtpConfig> {
    const normalizeProvider = (smtp: MailSmtpConfig): MailSmtpConfig => {
      const provider = (smtp.provider || '').toLowerCase();

      if (provider === 'smtp2go') {
        return {
          ...smtp,
          host: smtp.host || this.getEnvValue('SMTP2GO_HOST') || 'mail.smtp2go.com',
          port: smtp.port || Number(this.getEnvValue('SMTP2GO_PORT') || 587),
          secure: smtp.secure || false,
          username:
            smtp.username || this.getEnvValue('SMTP2GO_USER', 'SMTP2GO_USERNAME'),
          password:
            smtp.password || this.getEnvValue('SMTP2GO_PASS', 'SMTP2GO_PASSWORD'),
        };
      }

      if (provider === 'sendgrid') {
        const apiKey = smtp.password || this.getEnvValue('SENDGRID_API_KEY');
        return {
          ...smtp,
          host: smtp.host || this.getEnvValue('SENDGRID_SMTP_HOST') || 'smtp.sendgrid.net',
          port: smtp.port || Number(process.env.SENDGRID_SMTP_PORT || 587),
          secure: smtp.secure || false,
          username: smtp.username || 'apikey',
          password: apiKey,
        };
      }

      if (provider === 'mailtrap') {
        return {
          ...smtp,
          host:
            smtp.host ||
            this.getEnvValue('MAILTRAP_HOST', 'MAILTRAP_SMTP_HOST') ||
            'sandbox.smtp.mailtrap.io',
          port: smtp.port || Number(process.env.MAILTRAP_PORT || 2525),
          secure: smtp.secure || false,
          username:
            smtp.username || this.getEnvValue('MAILTRAP_USER', 'MAILTRAP_USERNAME'),
          password:
            smtp.password || this.getEnvValue('MAILTRAP_PASS', 'MAILTRAP_PASSWORD'),
        };
      }

      return smtp;
    };

    const resolveEnvSmtpConfig = (): MailSmtpConfig | null => {
      const provider = this.getEnvValue('MAIL_PROVIDER');
      const fromEmail = this.getEnvValue('MAIL_FROM_EMAIL');

      if (!fromEmail) {
        return null;
      }

      if ((provider || '').toLowerCase() === 'mailtrap') {
        return normalizeProvider({
          provider: 'mailtrap',
          host:
            this.getEnvValue('MAIL_HOST', 'SMTP_HOST', 'MAILTRAP_HOST', 'MAILTRAP_SMTP_HOST') ||
            'sandbox.smtp.mailtrap.io',
          port: Number(this.getEnvValue('MAIL_PORT', 'MAILTRAP_PORT') || 2525),
          secure: this.getEnvValue('MAIL_SECURE') === 'true',
          username: this.getEnvValue('MAIL_USER', 'MAILTRAP_USER', 'MAILTRAP_USERNAME'),
          password: this.getEnvValue('MAIL_PASS', 'MAILTRAP_PASS', 'MAILTRAP_PASSWORD'),
          fromEmail,
          fromName: this.getEnvValue('MAIL_FROM_NAME'),
          replyTo: this.getEnvValue('MAIL_REPLY_TO'),
        });
      }

      if ((provider || '').toLowerCase() === 'sendgrid') {
        return normalizeProvider({
          provider: 'sendgrid',
          host:
            this.getEnvValue('MAIL_HOST', 'SMTP_HOST', 'SENDGRID_SMTP_HOST') ||
            'smtp.sendgrid.net',
          port: Number(this.getEnvValue('MAIL_PORT', 'SENDGRID_SMTP_PORT') || 587),
          secure: this.getEnvValue('MAIL_SECURE') === 'true',
          username: this.getEnvValue('MAIL_USER') || 'apikey',
          password: this.getEnvValue('MAIL_PASS', 'SENDGRID_API_KEY'),
          fromEmail,
          fromName: this.getEnvValue('MAIL_FROM_NAME'),
          replyTo: this.getEnvValue('MAIL_REPLY_TO'),
        });
      }

      if ((provider || '').toLowerCase() === 'smtp2go') {
        return normalizeProvider({
          provider: 'smtp2go',
          host:
            this.getEnvValue('MAIL_HOST', 'SMTP_HOST', 'SMTP2GO_HOST') ||
            'mail.smtp2go.com',
          port: Number(this.getEnvValue('MAIL_PORT', 'SMTP2GO_PORT') || 587),
          secure: this.getEnvValue('MAIL_SECURE') === 'true',
          username:
            this.getEnvValue('MAIL_USER', 'SMTP2GO_USER', 'SMTP2GO_USERNAME'),
          password:
            this.getEnvValue('MAIL_PASS', 'SMTP2GO_PASS', 'SMTP2GO_PASSWORD'),
          fromEmail,
          fromName: this.getEnvValue('MAIL_FROM_NAME'),
          replyTo: this.getEnvValue('MAIL_REPLY_TO'),
        });
      }

      const host = this.getEnvValue('MAIL_HOST', 'SMTP_HOST');
      if (!host) {
        return null;
      }

      return normalizeProvider({
        provider,
        host,
        port: Number(this.getEnvValue('MAIL_PORT') || 587),
        secure: this.getEnvValue('MAIL_SECURE') === 'true',
        username: this.getEnvValue('MAIL_USER'),
        password: this.getEnvValue('MAIL_PASS'),
        fromEmail,
        fromName: this.getEnvValue('MAIL_FROM_NAME'),
        replyTo: this.getEnvValue('MAIL_REPLY_TO'),
      });
    };

    const envSmtpConfig = resolveEnvSmtpConfig();
    const preferEnvSmtp =
      Boolean(envSmtpConfig) &&
      (
        this.getEnvValue('MAIL_FORCE_ENV_SMTP') === 'true' ||
        (process.env.NODE_ENV || 'development').toLowerCase() === 'development'
      );

    if (preferEnvSmtp && envSmtpConfig) {
      return envSmtpConfig;
    }

    if (tenantConnection) {
      const tenantRepo = tenantConnection.getRepository(TenantMailSetting);
      const tenantSetting = await tenantRepo.findOne({
        where: { isActive: true },
        order: { id: 'DESC' },
      });

      if (tenantSetting) {
        return normalizeProvider({
          provider: tenantSetting.provider,
          host: tenantSetting.host,
          port: tenantSetting.port,
          secure: tenantSetting.secure,
          username: tenantSetting.username,
          password: decryptMailSecret(tenantSetting.encryptedPassword),
          fromEmail: tenantSetting.fromEmail,
          fromName: tenantSetting.fromName,
          replyTo: tenantSetting.replyTo,
        });
      }
    }

    const globalSetting = await this.globalMailSettingRepo.findOne({
      where: { isActive: true },
      order: { id: 'DESC' },
    });

    if (globalSetting) {
      return normalizeProvider({
        provider: globalSetting.provider,
        host: globalSetting.host,
        port: globalSetting.port,
        secure: globalSetting.secure,
        username: globalSetting.username,
        password: decryptMailSecret(globalSetting.encryptedPassword),
        fromEmail: globalSetting.fromEmail,
        fromName: globalSetting.fromName,
        replyTo: globalSetting.replyTo,
      });
    }

    if (!envSmtpConfig) {
      throw new InternalServerErrorException('No active SMTP configuration was found.');
    }

    return envSmtpConfig;
  }

  async sendTemplateMail(req: any, options: SendTemplateMailOptions): Promise<SendTemplateMailResult> {
    const { tenantConnection, template } = await this.templateService.getEffectiveTemplate({
      module: options.module,
      action: options.action,
      role: options.role,
      tenantId: options.tenantId || req?.tenantId || null,
      req,
    });

    const resolver = this.getResolver(options.module);
    const resolvedData = await resolver.resolve({
      module: options.module,
      action: options.action,
      tenantId: options.tenantId || req?.tenantId || null,
      req,
      tenantConnection,
      data: options.data || {},
    });

    const subjectMissing = assertTemplateVariables(template.subject, resolvedData);
    const bodyMissing = assertTemplateVariables(template.body, resolvedData);
    const missingVariables = Array.from(new Set([...subjectMissing, ...bodyMissing]));
    if (missingVariables.length) {
      throw new BadRequestException(
        `Missing email template variables: ${missingVariables.join(', ')}`,
      );
    }

    const recipients = await this.resolveRecipients(tenantConnection, template, options, resolvedData);
    const subject = renderTemplate(template.subject, resolvedData, { escape: false });
    const body = renderTemplate(template.body, resolvedData);
    const smtp = await this.loadSmtpConfig(tenantConnection);
    const idempotencyKey = this.buildIdempotencyKey({
      module: options.module,
      action: options.action,
      tenantId: options.tenantId || req?.tenantId || null,
      templateId: template.id,
      version: template.version,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject,
      body,
      explicitKey: options.idempotencyKey,
    });

    const existingLog = await this.emailLogRepo.findOne({ where: { idempotencyKey } });
    if (existingLog) {
      return {
        success: true,
        status: existingLog.status === EMAIL_LOG_STATUS.SENT ? 'sent' : 'queued',
        logId: existingLog.id,
        idempotencyKey,
      };
    }

    const log = await this.emailLogRepo.save(
      this.emailLogRepo.create({
        tenantId: options.tenantId || req?.tenantId || null,
        module: options.module,
        action: options.action,
        templateId: template.id,
        templateVersion: template.version,
        templateName: template.name,
        idempotencyKey,
        to: recipients.to.join(','),
        cc: recipients.cc.length ? recipients.cc.join(',') : null,
        bcc: recipients.bcc.length ? recipients.bcc.join(',') : null,
        subject,
        body,
        status: EMAIL_LOG_STATUS.PENDING,
        provider: smtp.provider || null,
        smtpHost: smtp.host,
        fromEmail: smtp.fromEmail,
        metadata: {
          module: options.module,
          action: options.action,
          role: options.role || null,
          template_version: template.version,
        },
      }),
    );

    const payload: EmailJobPayload = {
      logId: log.id,
      tenantId: options.tenantId || req?.tenantId || null,
      templateId: template.id,
      templateVersion: template.version,
      module: options.module,
      action: options.action,
      idempotencyKey,
      to: recipients.to,
      cc: recipients.cc,
      bcc: recipients.bcc,
      subject,
      body,
      smtp,
    };

    if ((process.env.NODE_ENV || 'development').toLowerCase() === 'development') {
      await this.emailDispatchService.dispatch(payload, 1, 1);
      return {
        success: true,
        status: 'sent',
        logId: log.id,
        idempotencyKey,
      };
    }

    await this.queueService.enqueueEmail(payload);
    return {
      success: true,
      status: 'queued',
      logId: log.id,
      idempotencyKey,
    };
  }
}