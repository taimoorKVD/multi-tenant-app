import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not, Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { TenantAbstractService } from '../../common/abstract';
import { Role } from '../role/entities';
import { SendUserCredentialsDto } from './dto';
import { MailService } from '../../mail/mail.service';
import { User } from './entities';
import { DynamicFieldsService, DynamicSchemaContext } from '../form-builder/services';
import { JobPosition } from '../job-positions/entities';
import { emailEscape, renderEmailLayout } from '../../mail/utils/email-layout.util';
import {
  EMAIL_LOGO_PUBLIC_PATH,
  prepareEmailLogo,
  toNodemailerLogoAttachments,
} from '../../mail/utils/email-logo.util';

@Injectable()
export class UsersService extends TenantAbstractService<User> {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly dynamicFields: DynamicFieldsService,
  ) {
    super(dataSource.getRepository(User));
  }

  private readonly usersModuleSlug = 'users';

  private readonly fallbackSystemFieldKeys = new Set([
    'id',
    'name',
    'email',
    'password',
    'plain_password',
    'role_id',
    'job_position_id',
    'phone_number',
    'is_system',
    'created_at',
    'updated_at',
  ]);

  private readonly ignoredPayloadKeys = new Set(['password_confirm', 'createdBy', 'updatedBy']);

  private readonly relationFieldAliases: Record<string, string> = {
    role: 'role_id',
    jobPosition: 'job_position_id',
    job_position: 'job_position_id',
    phone: 'phone_number',
    phoneNumber: 'phone_number',
  };

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  private getPlatformHost(): string {
    const explicit = this.getEnvValue('PLATFORM_DOMAIN');
    if (explicit) return explicit.replace(/^\./, '').replace(/\/+$/, '');

    try {
      return new URL(this.getFrontendBaseUrl()).hostname.replace(/^(www|admin)\./, '');
    } catch {
      return 'eusocial.thebetawebsite.com';
    }
  }

  private getTenantAppUrl(subdomain: string, customDomain?: string | null): string {
    if (customDomain?.trim()) {
      const host = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }

    let protocol = 'https';
    let port = '';
    try {
      const frontend = new URL(this.getFrontendBaseUrl());
      protocol = frontend.protocol.replace(':', '') || 'https';
      port = frontend.port ? `:${frontend.port}` : '';
    } catch {
      protocol = 'https';
    }

    return `${protocol}://${subdomain}.${this.getPlatformHost()}${port}`;
  }

  private getTenantLoginUrl(tenantSlug?: string | null, customDomain?: string | null): string {
    const slug = String(tenantSlug || '').trim();
    if (slug) {
      return `${this.getTenantAppUrl(slug, customDomain)}/login`;
    }
    return `${this.getFrontendBaseUrl()}/login`;
  }

  private getLogoUrl(tenantAppUrl: string): string {
    const configured = this.getEnvValue('MAIL_LOGO_URL', 'LOGO_URL');
    if (configured) return configured;
    return `${tenantAppUrl}${EMAIL_LOGO_PUBLIC_PATH}`;
  }

  private getEnvValue(...keys: string[]): string | null {
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) return value;
    }
    return null;
  }

  private resolveSmtpConfig() {
    const explicitFrom = this.getEnvValue('SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM_EMAIL');
    const smtpUsername = this.getEnvValue('SMTP_USER', 'MAIL_USER');
    const fromEmail =
      explicitFrom || (smtpUsername && smtpUsername.includes('@') ? smtpUsername : null);
    return {
      host: this.getEnvValue('SMTP_HOST', 'MAIL_HOST'),
      port: Number(this.getEnvValue('SMTP_PORT', 'MAIL_PORT') || 587),
      secure: String(this.getEnvValue('SMTP_SECURE') || '').toLowerCase() === 'true',
      username: smtpUsername,
      password: this.getEnvValue('SMTP_PASS', 'MAIL_PASS'),
      fromEmail,
      fromName: this.getEnvValue('SMTP_FROM_NAME') || 'EuSocial',
      replyTo: this.getEnvValue('SMTP_REPLY_TO'),
    };
  }

  private async sendEmployeeAccountReadyEmail(payload: {
    recipientEmail: string;
    employeeName?: string | null;
    loginEmail: string;
    password: string;
    tenantSlug?: string | null;
    customDomain?: string | null;
  }): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp.host || !smtp.fromEmail) {
      throw new BadRequestException(
        'SMTP is not configured with a verified sender. Set SMTP_HOST/SMTP_USER/SMTP_PASS and a verified SMTP_FROM.',
      );
    }

    const tenantAppUrl = payload.tenantSlug
      ? this.getTenantAppUrl(payload.tenantSlug, payload.customDomain)
      : this.getFrontendBaseUrl();
    const loginUrl = this.getTenantLoginUrl(payload.tenantSlug, payload.customDomain);
    const preparedLogo = await prepareEmailLogo(this.getLogoUrl(tenantAppUrl));
    const displayName = payload.employeeName?.trim() || 'there';

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username ? { user: smtp.username, pass: smtp.password || undefined } : undefined,
    });

    const subject = `Your EuSocial account is ready`;
    const html = renderEmailLayout({
      logoUrl: preparedLogo.logoSrc,
      title: 'Your Account Is Ready',
      preheader: 'Your EuSocial employee account credentials are ready.',
      introHtml: `<p style="margin:0;">Hi ${emailEscape(displayName)}, an employee account has been created for you. Use the credentials below to log in.</p>`,
      rows: [
        { label: 'Email', value: payload.loginEmail },
        { label: 'Password', value: payload.password, monospace: true },
      ],
      notice: {
        title: 'Security notice',
        text: 'Please change your password immediately after your first login.',
        variant: 'warning',
      },
      cta: { label: 'Go to Portal', url: loginUrl },
    });

    try {
      await transporter.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
        to: payload.recipientEmail,
        replyTo: smtp.replyTo || undefined,
        subject,
        html,
        attachments: toNodemailerLogoAttachments(preparedLogo.attachment),
      });
      this.logger.log(`Employee credentials email sent to ${payload.recipientEmail}`);
    } finally {
      transporter.close();
    }
  }

  private getActorId(req: any): number | null {
    const actorId = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    return typeof actorId === 'number' ? actorId : Number.isFinite(Number(actorId)) ? Number(actorId) : null;
  }

  private getUsersSchemaContext(req: any): Promise<DynamicSchemaContext> {
    return this.dynamicFields.getSchemaContext(req, this.usersModuleSlug, {
      fallbackSystemFieldKeys: this.fallbackSystemFieldKeys,
      relationFieldAliases: this.relationFieldAliases,
    });
  }

  private isEmptyRequiredValue(value: any): boolean {
    if (value === undefined || value === null) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  private coerceRelationId(value: unknown): number | null {
    if (!this.dynamicFields.hasPresentValue(value)) {
      return null;
    }

    // Form dropdowns often submit `[1]` or `[{ id: 1 }]` instead of a bare id.
    let candidate: unknown = value;
    if (Array.isArray(candidate)) {
      if (candidate.length === 0) return null;
      candidate = candidate[0];
    }

    if (typeof candidate === 'object' && candidate !== null && 'id' in (candidate as Record<string, unknown>)) {
      const id = Number((candidate as Record<string, unknown>).id);
      return Number.isFinite(id) ? id : null;
    }

    const id = Number(candidate);
    return Number.isFinite(id) ? id : null;
  }

  private assertCreatePayloadRequiredFields(
    payload: Record<string, any>,
    requiredFieldKeys: Set<string>,
    fieldLabels: Map<string, string> = new Map(),
  ): void {
    const missing = Array.from(requiredFieldKeys).filter((key) => {
      const value = payload[key];
      return this.isEmptyRequiredValue(value);
    });

    if (missing.length) {
      throw new BadRequestException({
        message: missing.map((key) => `${fieldLabels.get(key) || key} is required`),
        error: 'Bad Request',
        statusCode: 400,
        fields: missing.reduce(
          (acc, key) => ({
            ...acc,
            [key]: `${fieldLabels.get(key) || key} is required`,
          }),
          {} as Record<string, string>,
        ),
      });
    }

    if (payload.password_confirm !== undefined && payload.password_confirm !== payload.password) {
      throw new BadRequestException('Passwords do not match.');
    }
  }

  private buildRequiredValidationPayload(
    user: User,
    staticPayload: Record<string, any>,
    dynamicPayload: Record<string, any>,
  ): Record<string, any> {
    return {
      name: user.name,
      email: user.email,
      password: user.password,
      plain_password: user.plainPassword,
      role_id: user.role?.id,
      job_position_id: user.jobPosition?.id,
      ...staticPayload,
      ...dynamicPayload,
    };
  }

  private buildUserResponse(
    user: User,
    dynamicData: Record<string, any> = {},
    context: DynamicSchemaContext,
  ): Record<string, any> {
    return this.dynamicFields.buildResponse(
      context,
      {
        name: user.name,
        email: user.email,
        // Edit forms need the stored plaintext; never expose the argon2 hash.
        password: user.plainPassword ?? null,
        role_id: user.role?.id ?? null,
        job_position_id: user.jobPosition?.id ?? null,
        phone_number: user.phoneNumber ?? null,
      },
      dynamicData,
      {
        id: user.id,
        is_system: user.isSystem,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        job_position: user.jobPosition
          ? { id: user.jobPosition.id, name: user.jobPosition.name }
          : null,
      },
    );
  }

  private async applyStaticPayloadToUser(
    req: any,
    user: User,
    staticPayload: Record<string, any>,
    options: { isCreate?: boolean } = {},
  ): Promise<void> {
    const userRepo = this.getRepo(req);
    const roleRepo: Repository<Role> = req.tenantConnection.getRepository(Role);
    const isCreate = options.isCreate ?? false;

    const shouldApplyScalar = (value: unknown) => isCreate || this.dynamicFields.hasPresentValue(value);

    if (shouldApplyScalar(staticPayload.name) && staticPayload.name !== undefined) {
      user.name = staticPayload.name;
    }

    if (staticPayload.email !== undefined && (isCreate || this.dynamicFields.hasPresentValue(staticPayload.email))) {
      if (!isCreate && staticPayload.email !== user.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing && existing.id !== user.id) {
          throw new BadRequestException('Email already in use by another user.');
        }
      }
      user.email = staticPayload.email;
    }

    if (this.dynamicFields.hasPresentValue(staticPayload.password)) {
      user.password = staticPayload.password;
      user.plainPassword = staticPayload.plain_password || staticPayload.password;
    }

    if (isCreate || staticPayload.phone_number !== undefined) {
      if (staticPayload.phone_number === null || staticPayload.phone_number === '') {
        user.phoneNumber = null;
      } else if (shouldApplyScalar(staticPayload.phone_number)) {
        user.phoneNumber = String(staticPayload.phone_number).trim();
      }
    }

    const roleId = this.coerceRelationId(staticPayload.role_id);
    if (roleId !== null && roleId !== user.role?.id) {
      const newRole = await roleRepo.findOne({ where: { id: roleId } });
      if (!newRole) throw new BadRequestException(`Role with ID ${roleId} not found.`);
      user.role = newRole;
    } else if (isCreate && !user.role) {
      // New staff users default to Employee; only the provisioned bootstrap user is Admin.
      const employeeRole = await roleRepo.findOne({ where: { name: 'Employee' } });
      if (employeeRole) {
        user.role = employeeRole;
      } else {
        throw new BadRequestException(
          'Employee role is not configured for this tenant. Create an Employee role or pass role_id.',
        );
      }
    }

    if (isCreate || staticPayload.job_position_id !== undefined) {
      const jobPositionRepo: Repository<JobPosition> = req.tenantConnection.getRepository(JobPosition);
      const jobPositionId = this.coerceRelationId(staticPayload.job_position_id);

      if (jobPositionId === null) {
        if (!isCreate || staticPayload.job_position_id !== undefined) {
          user.jobPosition = null;
        }
      } else if (jobPositionId !== user.jobPosition?.id) {
        const jobPosition = await jobPositionRepo.findOne({ where: { id: jobPositionId } });
        if (!jobPosition) {
          throw new BadRequestException(`Job position with ID ${jobPositionId} not found.`);
        }
        user.jobPosition = jobPosition;
      }
    }
  }

  override async findAll(req: any, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const data = await repo.find({ where: { isSystem: Not(true) } as any, relations });
      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, data.map((user) => user.id), context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
        ),
      };
    } catch {
      throw new InternalServerErrorException('Failed to retrieve users');
    }
  }

  override async paginate(
    req: any,
    page = 1,
    relations: string[] = [],
    limit?: number,
  ): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const currentPage = Math.max(Number(page) || 1, 1);
      const queryOptions: any = {
        where: { isSystem: Not(true) } as any,
        relations,
        order: { id: 'DESC' } as any,
      };

      if (parsedLimit && parsedLimit > 0) {
        queryOptions.take = Math.min(Math.max(parsedLimit, 1), 100);
        queryOptions.skip = (currentPage - 1) * queryOptions.take;
      }

      const [data, total] = await repo.findAndCount(queryOptions);
      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, data.map((user) => user.id), context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        meta: {
          total,
          page: currentPage,
          lastPage: queryOptions.take ? Math.ceil(total / queryOptions.take) || 1 : 1,
        },
        data: data.map((user) =>
          this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
        ),
      };
    } catch {
      throw new InternalServerErrorException('Failed to paginate users');
    }
  }

  override async findOne(req: any, id: number, relations: string[] = []): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const entity = await repo.findOne({
        where: { id, isSystem: Not(true) } as any,
        relations,
      });
      if (!entity) throw new NotFoundException(`User with ID ${id} not found`);

      const context = await this.getUsersSchemaContext(req);
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, [entity.id], context);

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(entity, dynamicRows.get(entity.id) || {}, context),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async create(req: any, dto: Record<string, any>): Promise<any> {
    try {
      const context = await this.getUsersSchemaContext(req);
      const userRepo: Repository<User> = this.getRepo(req);

      const normalizedDto = this.dynamicFields.resolvePayloadAliases(dto, context.aliasToCanonicalMap, context);
      this.assertCreatePayloadRequiredFields(normalizedDto, context.requiredFieldKeys, context.fieldLabels);
      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalizedDto,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
        context,
      ));

      if (staticPayload.email) {
        const existing = await userRepo.findOne({ where: { email: staticPayload.email } });
        if (existing) throw new BadRequestException('A user with this email already exists.');
      }

      const user = userRepo.create({});
      await this.applyStaticPayloadToUser(req, user as User, staticPayload, { isCreate: true });

      const saved = await userRepo.save(user);

      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        saved.id,
        context.activeVersionId,
        dynamicPayload,
        this.getActorId(req),
        context,
      );

      const payload = await userRepo.findOne({
        where: { id: saved.id },
        relations: ['role', 'jobPosition'],
      });

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, saved.id, context);

      const plaintextPassword = staticPayload.password || staticPayload.plain_password || null;
      const recipientEmail = payload?.email || staticPayload.email || null;
      let credentialsEmail: { sent: boolean; error: string | null } = { sent: false, error: null };
      if (recipientEmail && plaintextPassword) {
        try {
          await this.sendEmployeeAccountReadyEmail({
            recipientEmail,
            employeeName: payload?.name || staticPayload.name,
            loginEmail: recipientEmail,
            password: plaintextPassword,
            tenantSlug: req?.tenantId || null,
            customDomain: req?.tenant?.customDomain || req?.customDomain || null,
          });
          credentialsEmail = { sent: true, error: null };
        } catch (mailError) {
          const mailErrorMessage = mailError instanceof Error ? mailError.message : 'Unknown email dispatch error';
          this.logger.warn(`Tenant user created but credentials email was not sent: ${mailErrorMessage}`);
          credentialsEmail = { sent: false, error: mailErrorMessage };
        }
      }

      return {
        success: true,
        message: 'Tenant user created successfully',
        tenant: req.tenantConnection.options.database,
        credentialsEmail,
        data: this.buildUserResponse(payload as User, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Tenant user creation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to create tenant user: ${errorMessage}`);
    }
  }

  async update(req: any, id: number, dto: Record<string, any>): Promise<any> {
    try {
      const context = await this.getUsersSchemaContext(req);
      const userRepo: Repository<User> = this.getRepo(req);

      const user = await userRepo.findOne({
        where: { id },
        relations: ['role', 'jobPosition'],
      });
      if (!user) throw new NotFoundException(`User with ID ${id} not found.`);
      if (user.isSystem) throw new BadRequestException('System users cannot be modified.');

      const normalizedDto = this.dynamicFields.resolvePayloadAliases(dto, context.aliasToCanonicalMap, context);
      let { staticPayload, dynamicPayload } = this.dynamicFields.splitPayload(
        normalizedDto,
        context.systemFieldKeys,
        this.ignoredPayloadKeys,
      );
      ({ staticPayload, dynamicPayload } = this.dynamicFields.promoteDynamicSystemFields(
        staticPayload,
        dynamicPayload,
        context.aliasToCanonicalMap,
        context.systemFieldKeys,
        context,
      ));
      const existingDynamic = context.moduleId
        ? await this.dynamicFields.loadDynamicRow(req, context.moduleId, user.id, context)
        : {};
      const mergedDynamic = {
        ...existingDynamic,
        ...dynamicPayload,
      };
      this.assertCreatePayloadRequiredFields(
        this.buildRequiredValidationPayload(user, staticPayload, mergedDynamic),
        context.requiredFieldKeys,
        context.fieldLabels,
      );

      await this.applyStaticPayloadToUser(req, user, staticPayload);

      const updated = await userRepo.save(user);
      await this.dynamicFields.upsertDynamicRow(
        req,
        context.moduleId,
        updated.id,
        context.activeVersionId,
        mergedDynamic,
        this.getActorId(req),
        context,
      );

      const payload = await userRepo.findOne({
        where: { id: updated.id },
        relations: ['role', 'jobPosition'],
      });

      const dynamicData = await this.dynamicFields.loadDynamicRow(req, context.moduleId, updated.id, context);

      /*
      void this.mailService
        .sendTemplateMail(req, {
          module: 'users',
          action: 'update',
          tenantId: req?.tenantId || null,
          to: payload?.email || undefined,
          data: {
            user_id: payload?.id,
            name: payload?.name,
            first_name: payload?.name?.split(' ')?.[0] || payload?.name,
            full_name: payload?.name,
            email: payload?.email,
            username: payload?.username,
            password: staticPayload.password || 'Not changed',
            user_password: staticPayload.password || 'Not changed',
            tenant_slug: req?.tenantId || null,
            tenant_login_url: this.getTenantLoginUrl(
              req?.tenantId || null,
              req?.tenant?.customDomain || req?.customDomain || null,
            ),
            logo_url: `${this.getFrontendBaseUrl()}${EMAIL_LOGO_PUBLIC_PATH}`,
            role_name: payload?.role?.name || null,

          },
        })
        .catch((mailError) => {
          console.error('Tenant user update email trigger failed:', mailError);
        });
      */

      return {
        success: true,
        message: 'Tenant user updated successfully',
        tenant: req.tenantConnection.options.database,
        data: this.buildUserResponse(payload as User, dynamicData, context),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Tenant user update failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to update tenant user: ${errorMessage}`);
    }
  }

  async search(
    req: any,
    limit = 15,
    filters?: {
      name?: string;
      email?: string;
      roleId?: number;
      dynamicFilters?: Record<string, any>;
    },
  ): Promise<any> {
    try {
      const userRepo: Repository<User> = this.getRepo(req);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const email = filters?.email?.trim();
      const roleId = filters?.roleId;
      const dynamicFilters = Object.entries(filters?.dynamicFilters || {}).reduce(
        (acc, [key, value]) => {
          const normalizedKey = String(key || '').trim();
          if (!normalizedKey) return acc;

          const normalizedValue =
            typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);

          if (!normalizedValue) return acc;

          acc[normalizedKey] = normalizedValue;
          return acc;
        },
        {} as Record<string, string>,
      );
      const hasFilters = Boolean(
        name ||
          email ||
          roleId ||
          Object.keys(dynamicFilters).length,
      );

      if (!hasFilters) {
        return {
          success: true,
          tenant: req.tenantConnection.options.database,
          count: 0,
          data: [],
        };
      }

      const context = await this.getUsersSchemaContext(req);

      const qb = userRepo
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.jobPosition', 'jobPosition')
        .where('user.isSystem = :isSystem', { isSystem: false });

      if (name) qb.andWhere('user.name ILIKE :name', { name: `%${name}%` });
      if (email) qb.andWhere('user.email ILIKE :email', { email: `%${email}%` });
      if (roleId) qb.andWhere('role.id = :roleId', { roleId });

      // Split incoming dynamic filters (which may be keyed by field id, name,
      // label, or key) into system-field filters (applied to the users table)
      // and true dynamic filters (applied to entity_dynamic_data).
      const trueDynamicFilters: Record<string, string> = {};
      for (const [key, value] of Object.entries(dynamicFilters)) {
        const canonicalKey = this.dynamicFields.resolveCanonicalKey(context, key);

        switch (canonicalKey) {
          case 'name':
            qb.andWhere('user.name ILIKE :sysName', { sysName: `%${value}%` });
            break;
          case 'email':
            qb.andWhere('user.email ILIKE :sysEmail', { sysEmail: `%${value}%` });
            break;
          case 'role_id': {
            const parsedRoleId = Number(value);
            if (Number.isFinite(parsedRoleId)) {
              qb.andWhere('role.id = :sysRoleId', { sysRoleId: parsedRoleId });
            }
            break;
          }
          case 'job_position_id': {
            const parsedJobPositionId = Number(value);
            if (Number.isFinite(parsedJobPositionId)) {
              qb.andWhere('jobPosition.id = :sysJobPositionId', {
                sysJobPositionId: parsedJobPositionId,
              });
            }
            break;
          }
          default:
            trueDynamicFilters[key] = value;
        }
      }

      if (Object.keys(trueDynamicFilters).length) {
        const matchedIds = await this.dynamicFields.findDynamicMatchedIds(req, context, trueDynamicFilters);
        if (matchedIds === null) {
          // no dynamic filters to apply
        } else if (!matchedIds.length) {
          return {
            success: true,
            tenant: req.tenantConnection.options.database,
            count: 0,
            data: [],
          };
        } else {
          qb.andWhere('user.id IN (:...dynamicIds)', { dynamicIds: matchedIds });
        }
      }

      qb.orderBy('user.id', 'DESC').take(take);

      const users = await qb.getMany();
      const dynamicRows = await this.dynamicFields.loadDynamicRows(req, context.moduleId, users.map((user) => user.id), context);

      const data = users.map((user) =>
        this.buildUserResponse(user, dynamicRows.get(user.id) || {}, context),
      );

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: data.length,
        data,
      };
    } catch (error) {
      console.error('Tenant user search failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new InternalServerErrorException(`Failed to search tenant users: ${errorMessage}`);
    }
  }

  async sendCredentials(req: any, id: number, dto: SendUserCredentialsDto): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const user = await repo.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const recipientEmail = dto.recipient_email || user.email;
      const password = dto.password || user.plainPassword;
      if (!recipientEmail) {
        throw new BadRequestException('A recipient email is required to send credentials.');
      }
      if (!password) {
        throw new BadRequestException('A password is required to send credentials.');
      }

      await this.sendEmployeeAccountReadyEmail({
        recipientEmail,
        employeeName: user.name,
        loginEmail: user.email || recipientEmail,
        password,
        tenantSlug: req?.tenantId || null,
        customDomain: req?.tenant?.customDomain || req?.customDomain || null,
      });

      return {
        success: true,
        message: 'Credentials email sent successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to send credentials email');
    }
  }

  async delete(req: any, id: number): Promise<any> {
    try {
      const repo = this.getRepo(req);
      const user = await repo.findOne({ where: { id } });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (user.isSystem) {
        throw new BadRequestException('System users cannot be deleted.');
      }

      await repo.remove(user);

      const context = await this.getUsersSchemaContext(req);
      await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }

  async bulkDelete(req: any, ids: number[]): Promise<any> {
    try {
      const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      if (!uniqueIds.length) {
        throw new BadRequestException('At least one valid ID is required');
      }

      const repo = this.getRepo(req);
      const users = await repo.findBy({ id: In(uniqueIds) });
      const foundIds = users.map((user) => user.id);
      const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));

      if (missingIds.length) {
        throw new NotFoundException(`Users not found for IDs: ${missingIds.join(', ')}`);
      }

      const systemUsers = users.filter((user) => user.isSystem);
      if (systemUsers.length) {
        throw new BadRequestException(
          `System users cannot be deleted: ${systemUsers.map((user) => user.id).join(', ')}`,
        );
      }

      await repo.remove(users);

      const context = await this.getUsersSchemaContext(req);
      for (const id of foundIds) {
        await this.dynamicFields.deleteDynamicRow(req, context.moduleId, id);
      }

      return {
        success: true,
        message: `${foundIds.length} user(s) deleted successfully`,
        tenant: req.tenantConnection.options.database,
        data: { deletedIds: foundIds, count: foundIds.length },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to bulk delete users');
    }
  }

  private splitDisplayName(fullName: string | null | undefined): {
    first_name: string;
    last_name: string;
  } {
    const trimmed = String(fullName || '').trim();
    if (!trimmed) return { first_name: '', last_name: '' };
    const parts = trimmed.split(/\s+/);
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' '),
    };
  }

  private buildProfilePayload(user: User) {
    const { first_name, last_name } = this.splitDisplayName(user.name);
    return {
      id: user.id,
      name: user.name,
      first_name,
      last_name,
      email: user.email,
      phone: user.phoneNumber,
      phone_number: user.phoneNumber,
      role: user.role
        ? {
            id: user.role.id,
            name: user.role.name,
          }
        : null,
      account_type: user.role?.name || null,
      job_position: user.jobPosition
        ? { id: user.jobPosition.id, name: user.jobPosition.name }
        : null,
      is_system: user.isSystem,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    };
  }

  async getOwnProfile(req: any) {
    try {
      const userId = this.getActorId(req);
      if (!userId) {
        throw new BadRequestException('Authenticated user is required');
      }

      const repo = this.getRepo(req);
      const user = await repo.findOne({
        where: { id: userId },
        relations: ['role', 'jobPosition'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        success: true,
        message: 'Profile fetched successfully',
        tenant: req.tenantConnection?.options?.database,
        tenant_slug: req.tenantId || null,
        data: this.buildProfilePayload(user),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to fetch profile');
    }
  }

  async updateOwnProfile(req: any, dto: Record<string, any>) {
    try {
      const userId = this.getActorId(req);
      if (!userId) {
        throw new BadRequestException('Authenticated user is required');
      }

      const repo = this.getRepo(req);
      const user = await repo.findOne({
        where: { id: userId },
        relations: ['role', 'jobPosition'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const firstName =
        dto.first_name !== undefined ? String(dto.first_name || '').trim() : undefined;
      const lastName =
        dto.last_name !== undefined ? String(dto.last_name || '').trim() : undefined;

      if (dto.name !== undefined) {
        user.name = String(dto.name || '').trim() || null;
      } else if (firstName !== undefined || lastName !== undefined) {
        const current = this.splitDisplayName(user.name);
        const nextFirst = firstName !== undefined ? firstName : current.first_name;
        const nextLast = lastName !== undefined ? lastName : current.last_name;
        user.name = [nextFirst, nextLast].filter(Boolean).join(' ') || null;
      }

      const phoneValue = dto.phone !== undefined ? dto.phone : dto.phoneNumber ?? dto.phone_number;
      if (phoneValue !== undefined) {
        user.phoneNumber =
          phoneValue === null || String(phoneValue).trim() === ''
            ? null
            : String(phoneValue).trim();
      }

      // Email and role are read-only on profile screen.
      const saved = await repo.save(user);
      const refreshed = await repo.findOne({
        where: { id: saved.id },
        relations: ['role', 'jobPosition'],
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        tenant: req.tenantConnection?.options?.database,
        tenant_slug: req.tenantId || null,
        data: this.buildProfilePayload(refreshed as User),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to update profile');
    }
  }
}
