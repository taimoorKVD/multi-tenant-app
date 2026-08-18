import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {toDbNameSlug, toSubdomainSlug} from '../../utils';
import {getTenantDataSource, tenantConnections} from '../../database/datasource';
import {Tenant} from './entities';
import {User} from '../../tenants/users/entities';
import * as argon2 from 'argon2';
import * as nodemailer from 'nodemailer';
import {Role} from '../../tenants/role/entities';
import {CreateTenantDto, UpdateTenantDto} from './dto';
import {IAdminSetup, ITenantResponse} from './interfaces';
import {Country} from '../countries/entities';
import {State} from '../states/entities';
import {TENANT_INDUSTRIES} from './tenant-industries';
import {Permission} from '../../tenants/permission/entities';
import {ApiResponse} from '../../common/abstract';
import { FORM_BUILDER_MODULE_SEEDS, FormBuilderFieldSeed } from '../../tenants/form-builder/config/module-seeds';
import {
  DynamicModule,
  Form,
  FormStatus,
} from '../../tenants/form-builder/entities';
import { UnauthorizedException } from '@nestjs/common';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  protected readonly paginateLimit = 15;

  private toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
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

  private getFrontendBaseUrl(): string {
    const frontendUrl = this.getEnvValue('FRONTEND_URL', 'APP_FRONTEND_URL');
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    this.logger.warn(
      'FRONTEND_URL is not configured. Falling back to default frontend URL for email links.',
    );
    return 'https://eusocial-admin.vercel.app';
  }

  private resolveSmtpConfig() {
    const explicitFrom = this.getEnvValue('SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM_EMAIL');
    const smtpUsername = this.getEnvValue('SMTP_USER', 'MAIL_USER');
    const fromEmail =
      explicitFrom || (smtpUsername && smtpUsername.includes('@') ? smtpUsername : null);

    if (!fromEmail) {
      return null;
    }

    // Guard against common placeholder values that SMTP providers reject.
    const blockedDomains = ['yourdomain.com', 'example.com'];
    const fromDomain = fromEmail.split('@')[1]?.toLowerCase() || '';
    if (blockedDomains.includes(fromDomain)) {
      return null;
    }

    return {
      host: this.getEnvValue('SMTP_HOST', 'MAIL_HOST'),
      port: Number(this.getEnvValue('SMTP_PORT', 'MAIL_PORT') || 587),
      secure: this.getEnvValue('SMTP_SECURE', 'MAIL_SECURE') === 'true',
      username: smtpUsername,
      password: this.getEnvValue('SMTP_PASS', 'MAIL_PASS'),
      fromEmail,
      fromName: this.getEnvValue('MAIL_FROM_NAME'),
      replyTo: this.getEnvValue('MAIL_REPLY_TO'),
    };
  }

  private async sendTenantCredentialsEmail(payload: {
    tenantName: string;
    tenantSubdomain: string;
    customDomain?: string | null;
    recipientEmail: string;
    loginEmail: string;
    adminPassword: string;
  }): Promise<void> {
    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      throw new BadRequestException(
        'SMTP is not configured with a verified sender. Set SMTP_HOST/SMTP_USER/SMTP_PASS and a verified SMTP_FROM.',
      );
    }

    const frontendBaseUrl = this.getFrontendBaseUrl();
    const logoUrl = `${frontendBaseUrl}/assets/eusocial-logo.png`;
    const loginUrl = `${frontendBaseUrl}/tenant/login`;

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username
        ? {
            user: smtp.username,
            pass: smtp.password || undefined,
          }
        : undefined,
    });

    const subject = `Tenant account ready: ${payload.tenantName}`;
    const html = `
      <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
                <tr>
                  <td style="padding:24px 28px;background:#101820;">
                    <img src="${logoUrl}" alt="EuSocial" style="height:50px;display:block;" />
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 22px;color:#1f2d3d;">
                    <h2 style="margin:0 0 10px;font-size:24px;line-height:30px;color:#0b2948;">Tenant Ready to Launch</h2>
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">
                      Your tenant <strong>${payload.tenantName}</strong> has been successfully created and is now active. Use the credentials below to log in.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 22px;border:1px solid #e8edf3;border-radius:10px;background:#f9fafb;">
                      <tr style="border-bottom:1px solid #e8edf3;">
                        <td style="padding:14px 16px;font-size:13px;color:#7b8794;background:#f5f8fb;"><strong>Admin Email</strong></td>
                        <td style="padding:14px 16px;font-size:14px;color:#1f2d3d;">${payload.loginEmail}</td>
                      </tr>
                      <tr style="border-bottom:1px solid #e8edf3;">
                        <td style="padding:14px 16px;font-size:13px;color:#7b8794;background:#f5f8fb;"><strong>Password</strong></td>
                        <td style="padding:14px 16px;font-size:14px;color:#1f2d3d;font-family:monospace;background:#fafbfc;">${payload.adminPassword}</td>
                      </tr>
                      <tr>
                        <td style="padding:14px 16px;font-size:13px;color:#7b8794;background:#f5f8fb;"><strong>Login URL</strong></td>
                        <td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><a href="${loginUrl}" style="color:#0b73e6;text-decoration:none;">${loginUrl}</a></td>
                      </tr>
                    </table>
                    <div style="background:#fef3cd;border-left:4px solid #ffc107;padding:12px 14px;border-radius:4px;margin:16px 0;">
                      <p style="margin:0;font-size:13px;color:#856404;"><strong>⚠️ Security Notice:</strong> Please change your password immediately after your first login.</p>
                    </div>
                    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#7b8794;">
                      © 2026 EuSocial. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
        to: payload.recipientEmail,
        replyTo: smtp.replyTo || undefined,
        subject,
        html,
      });

      this.logger.log(`📧 Tenant credentials email sent to ${payload.recipientEmail}`);
    } finally {
      transporter.close();
    }
  }

  private async sendCreateTenantEmails(payload: {
    tenantName: string;
    subdomain: string;
    customDomain?: string | null;
    adminEmail: string;
    adminPassword: string;
    businessEmail: string;
  }): Promise<{ sent: boolean; recipients: string[]; error: string | null }> {
    const recipients = [...new Set([payload.adminEmail, payload.businessEmail].filter(Boolean))];
    if (!recipients.length) {
      return { sent: false, recipients: [], error: 'No recipient email provided' };
    }

    try {
      for (const recipientEmail of recipients) {
        await this.sendTenantCredentialsEmail({
          tenantName: payload.tenantName,
          tenantSubdomain: payload.subdomain,
          customDomain: payload.customDomain,
          recipientEmail,
          loginEmail: payload.adminEmail,
          adminPassword: payload.adminPassword,
        });
      }
      return { sent: true, recipients, error: null };
    } catch (error) {
      const message = this.toError(error).message;
      this.logger.warn(`Tenant created but credentials email was not sent: ${message}`);
      return { sent: false, recipients, error: message };
    }
  }

  constructor(
      @InjectRepository(Tenant)
      private tenantRepo: Repository<Tenant>,
      private dataSource: DataSource,
      private readonly billingService: BillingService,
  ) {}

  private domainToSubdomain(domain: string): string {
    const host = String(domain || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .replace(/^www\./, '');
    const firstLabel = host.split('.')[0] || host;
    return toSubdomainSlug(firstLabel);
  }

  private phoneDisplay(tenant: Tenant): string | null {
    const code = tenant.phoneCountryCode?.trim();
    const number = tenant.phoneNumber?.trim();
    if (!code && !number) return null;
    return [code, number].filter(Boolean).join(' ');
  }

  private serializeTenant(
    tenant: Tenant,
    extras?: {
      plan?: string | null;
      planId?: number | null;
      subscriptionStatus?: string | null;
      billingCycle?: string | null;
      trialEndsAt?: Date | null;
      users?: number | null;
    },
  ) {
    return {
      id: tenant.id,
      name: tenant.name,
      dbName: tenant.dbName,
      subdomain: tenant.subdomain,
      customDomain: tenant.customDomain ?? null,
      subdomainUrl: `https://${tenant.subdomain}.eusocial.com`,
      customDomainUrl: tenant.customDomain ? `https://${tenant.customDomain}` : null,
      email: tenant.email ?? null,
      phoneCountryCode: tenant.phoneCountryCode ?? null,
      phoneNumber: tenant.phoneNumber ?? null,
      phone: this.phoneDisplay(tenant),
      industry: tenant.industry ?? null,
      description: tenant.description ?? null,
      countryId: tenant.countryId ?? null,
      country: tenant.country
        ? { id: tenant.country.id, name: tenant.country.name, code: tenant.country.code }
        : null,
      stateId: tenant.stateId ?? null,
      state: tenant.state ? { id: tenant.state.id, name: tenant.state.name } : null,
      city: tenant.city ?? null,
      address: tenant.address ?? null,
      postalCode: tenant.postalCode ?? null,
      status: tenant.status || 'active',
      plan: extras?.plan ?? null,
      planId: extras?.planId ?? null,
      subscriptionStatus: extras?.subscriptionStatus ?? null,
      billingCycle: extras?.billingCycle ?? null,
      trialEndsAt: extras?.trialEndsAt ?? null,
      users: extras?.users ?? null,
      createdAt: tenant.createdAt,
    };
  }

  private async withBilling(tenants: Tenant[]) {
    const subscriptions = await this.billingService.latestSubscriptionByTenantIds(
      tenants.map((tenant) => tenant.id),
    );
    return tenants.map((tenant) => {
      const subscription = subscriptions.get(tenant.id);
      return this.serializeTenant(tenant, {
        plan: subscription?.plan?.name ?? null,
        planId: subscription?.planId ?? null,
        subscriptionStatus: subscription?.status ?? null,
        billingCycle: subscription?.billingCycle ?? null,
        trialEndsAt: subscription?.trialEndsAt ?? null,
        users: null,
      });
    });
  }

  private async assertLocation(countryId?: number, stateId?: number) {
    if (countryId) {
      const country = await this.dataSource.getRepository(Country).findOne({ where: { id: countryId } });
      if (!country) throw new BadRequestException('Country not found');
    }
    if (stateId) {
      const state = await this.dataSource.getRepository(State).findOne({ where: { id: stateId } });
      if (!state) throw new BadRequestException('State not found');
      if (countryId && state.countryId !== countryId) {
        throw new BadRequestException('State does not belong to the selected country');
      }
    }
  }

  listIndustries() {
    return {
      success: true,
      data: TENANT_INDUSTRIES.map((name) => ({ name })),
      count: TENANT_INDUSTRIES.length,
    };
  }

  async paginate(page = 1, limit?: number): Promise<ApiResponse<any>> {
    try {
      const parsedLimit = limit !== undefined ? Number(limit) : undefined;
      const take =
        parsedLimit !== undefined && Number.isFinite(parsedLimit) && parsedLimit > 0
          ? Math.min(Math.max(parsedLimit, 1), 100)
          : undefined;
      const skip = take ? (page - 1) * take : 0;

      const [data, total] = await this.tenantRepo.findAndCount({
        relations: ['country', 'state'],
        order: { id: 'DESC' },
        ...(take ? {take, skip} : {}),
      });
      const withBilling = await this.withBilling(data);

      return {
        success: true,
        message:
          data.length > 0
            ? `${data.length} tenant${data.length > 1 ? 's' : ''} retrieved successfully`
            : 'No tenants found',
        data: withBilling,
        meta: { total, page, lastPage: take ? Math.ceil(total / take) : 1 },
      };
    } catch (error) {
      const err = this.toError(error);
      this.logger.error(`❌ Tenant retrieval failed: ${err.message}`, err.stack);

      throw new InternalServerErrorException(
          'An unexpected error occurred while fetching tenants. Please try again later.',
      );
    }
  }

  async search(
    limit = 15,
    filters?: {
      name?: string;
      dbName?: string;
      subdomain?: string;
      customDomain?: string;
    },
  ): Promise<ApiResponse<Partial<Tenant>>> {
    try {
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
      const name = filters?.name?.trim();
      const dbName = filters?.dbName?.trim();
      const subdomain = filters?.subdomain?.trim();
      const customDomain = filters?.customDomain?.trim();
      const hasFilters = Boolean(name || dbName || subdomain || customDomain);

      if (!hasFilters) {
        return {
          success: true,
          message: 'No filters provided',
          data: [],
          meta: { total: 0, page: 1, lastPage: 1 },
        };
      }

      const qb = this.tenantRepo.createQueryBuilder('tenant');

      if (name) {
        qb.andWhere('tenant.name ILIKE :name', {name: `%${name}%`});
      }

      if (dbName) {
        qb.andWhere('tenant.dbName ILIKE :dbName', {dbName: `%${dbName}%`});
      }

      if (subdomain) {
        qb.andWhere('tenant.subdomain ILIKE :subdomain', {subdomain: `%${subdomain}%`});
      }

      if (customDomain) {
        qb.andWhere('tenant.customDomain ILIKE :customDomain', {
          customDomain: `%${customDomain}%`,
        });
      }

      const data = await qb.orderBy('tenant.id', 'DESC').take(take).getMany();

      return {
        success: true,
        message: data.length > 0 ? 'Matching tenants fetched successfully' : 'No matching tenants found',
        data,
        meta: { total: data.length, page: 1, lastPage: 1 },
      };
    } catch (error) {
      const err = this.toError(error);
      this.logger.error(`❌ Tenant search failed: ${err.message}`, err.stack);
      throw new InternalServerErrorException('An unexpected error occurred while searching tenants.');
    }
  }

  async findOne(
      identifier: number | string,
      relations: string[] = [],
  ): Promise<ApiResponse<any>> {
    try {
      let where: any = {};

      if (typeof identifier === 'number' || /^\d+$/.test(identifier as string)) {
        where = {id: Number(identifier)};
      } 
      // else if (typeof identifier! === 'string' && /^[a-zA-Z0-9_-]+$/.test(identifier)) {
      else if (typeof identifier === 'string' && /^[a-zA-Z0-9_-]+$/.test(identifier)) {
        where = {subdomain: identifier};
      } else if (typeof identifier! === 'string' && identifier.includes('.')) {
        where = {customDomain: identifier};
      } else {
        throw new BadRequestException(
            `Invalid tenant identifier: ${identifier}`,
        );
      }

      const record = await this.tenantRepo.findOne({
        where,
        relations: Array.from(new Set(['country', 'state', ...relations])),
      });

      if (!record) throw new UnauthorizedException(`Tenant not found for "${identifier}"`);

      const [serialized] = await this.withBilling([record]);

      return {
        success: true,
        message: 'Tenant fetched successfully',
        data: serialized,
      };
    } catch (error) {
      const err = this.toError(error);
      if (
          error instanceof BadRequestException ||
          error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(
          `❌ Tenant retrieval failed for identifier: ${identifier} → ${err.message}`,
          err.stack,
      );

      throw new InternalServerErrorException(
          'An unexpected error occurred while fetching tenant details. Please try again later.',
      );
    }
  }

  async findOneFlexible(value: string): Promise<Tenant | null> {
    if (!value || typeof value! !== 'string') {
      throw new BadRequestException('Invalid tenant lookup value.');
    }

    const lookup = value.toLowerCase().trim();

    try {
      const byDbName = await this.tenantRepo.findOne({
        where: {dbName: lookup},
      });
      if (byDbName) return byDbName;

      const bySubdomain = await this.tenantRepo.findOne({
        where: {subdomain: lookup},
      });
      if (bySubdomain) return bySubdomain;

      const byDomain = await this.tenantRepo.findOne({
        where: [{customDomain: lookup}],
      });
      if (byDomain) return byDomain;

      if (lookup.includes('@')) {
        const emailDomain = lookup.split('@')[1]?.toLowerCase();
        if (emailDomain) {
          const emailSub = emailDomain.split('.')[0];

          const byEmailDomain =
              (await this.tenantRepo.findOne({
                where: {subdomain: emailSub},
              })) ||
              (await this.tenantRepo.findOne({
                where: [{customDomain: emailDomain}],
              }));

          if (byEmailDomain) return byEmailDomain;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Tenant lookup failed:', this.toError(error));
      throw new InternalServerErrorException(
          'An unexpected error occurred while looking up tenant.',
      );
    }
  }

  async getTenantConnection(identifier: string): Promise<DataSource> {
    const tenant = await this.findOneFlexible(identifier);
    if (!tenant) {
      throw new UnauthorizedException(`Tenant not found for "${identifier}"`);
    }

    if (!tenant.dbName) {
      throw new BadRequestException(
        `Tenant "${identifier}" does not have a configured database.`,
      );
    }

    try {
      return await getTenantDataSource(tenant.dbName);
    } catch (err) {
      console.error(`❌ ERROR connecting tenant DB "${tenant.dbName}"`, err);
      throw new BadRequestException(
          `Unable to connect to database "${tenant.dbName}" for tenant "${identifier}"`,
      );
    }
  }

  async create(dto: CreateTenantDto): Promise<ITenantResponse> {
    const tenantName = dto.name?.trim();
    if (!tenantName) throw new BadRequestException('Tenant name is required');
    if (!dto.admin) throw new BadRequestException('Admin user details are required');

    let dbName = '';
    let tenantRecord: Tenant | null = null;

    try {
      await this.assertLocation(dto.countryId, dto.stateId);
      const subdomain = await this.ensureUniqueTenant(tenantName, dto.domain);
      dbName = toDbNameSlug(subdomain, 'tenant_');

      tenantRecord = this.tenantRepo.create({
        name: tenantName,
        dbName,
        subdomain,
        customDomain: null,
        email: dto.email.trim().toLowerCase(),
        phoneCountryCode: dto.phoneCountryCode?.trim() || null,
        phoneNumber: dto.phoneNumber?.trim() || null,
        industry: dto.industry?.trim() || null,
        description: dto.description?.trim() || null,
        countryId: dto.countryId || null,
        stateId: dto.stateId || null,
        city: dto.city?.trim() || null,
        address: dto.address?.trim() || null,
        postalCode: dto.postalCode?.trim() || null,
        status: dto.trialDays && dto.trialDays > 0 ? 'trial' : 'active',
      });
      await this.tenantRepo.save(tenantRecord);
      this.logger.log(`🟢 Tenant metadata saved: ${tenantName} -> ${dbName}`);

      await this.createDatabase(dbName);

      const tenantConnection = await getTenantDataSource(dbName);
      await tenantConnection.synchronize();

      const adminSetup = await this.bootstrapAdmin(tenantConnection, {
        name: dto.admin.name.trim(),
        email: dto.admin.email.trim().toLowerCase(),
        password: dto.admin.password,
      });
      await this.bootstrapTenantFormBuilder(tenantConnection, adminSetup.user.id);

      const subscription = await this.billingService.createSubscription({
        tenantId: tenantRecord.id,
        planId: dto.planId,
        billingCycle: dto.billingCycle,
        trialDays: dto.trialDays,
        chargeNow: false,
      });

      const saved = await this.tenantRepo.findOne({
        where: { id: tenantRecord.id },
        relations: ['country', 'state'],
      });

      const email = await this.sendCreateTenantEmails({
        tenantName,
        subdomain,
        customDomain: saved?.customDomain || null,
        adminEmail: dto.admin.email.trim().toLowerCase(),
        adminPassword: dto.admin.password,
        businessEmail: dto.email.trim().toLowerCase(),
      });

      return this.buildResponse(saved || tenantRecord, adminSetup, subscription.data, email);
    } catch (error) {
      const err = this.toError(error);
      this.logger.error(`❌ Tenant creation failed for "${tenantName}": ${err.message}`);

      await this.rollbackTenantCreation(tenantName, dbName, tenantRecord);
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Tenant creation failed: ${err.message}. All operations were rolled back to ensure data consistency.`,
      );
    }
  }

  private async ensureUniqueTenant(name: string, domain: string): Promise<string> {
    const subdomain = this.domainToSubdomain(domain);
    if (!subdomain) {
      throw new BadRequestException('Domain is required');
    }

    if (await this.tenantRepo.exists({ where: { name } })) {
      throw new ConflictException(`Tenant "${name}" already exists`);
    }

    if (await this.tenantRepo.exists({ where: { subdomain } })) {
      throw new ConflictException(`Domain "${domain}" is already in use`);
    }

    return subdomain;
  }

  private async createDatabase(dbName: string) {
    await this.dataSource.query(`CREATE DATABASE "${dbName}"`);
    this.logger.log(`🗄️ Database created: ${dbName}`);
  }

  async sendCredentials(id: number, recipientEmail: string) {
    try {
      const tenant = await this.tenantRepo.findOneBy({ id });
      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${id} not found.`);
      }

      let loginEmail = tenant.email || `admin@${tenant.subdomain}.eusocial.com`;
      let adminPassword = 'Admin@123';
      try {
        const connection = await getTenantDataSource(tenant.dbName);
        const admin = await connection.getRepository(User).findOne({
          where: { isSystem: true },
          order: { id: 'ASC' },
        });
        if (admin?.email) loginEmail = admin.email;
        if (admin?.plainPassword) adminPassword = admin.plainPassword;
      } catch (lookupError) {
        this.logger.warn(
          `Could not load tenant admin email for ${tenant.dbName}: ${this.toError(lookupError).message}`,
        );
      }

      await this.sendTenantCredentialsEmail({
        tenantName: tenant.name,
        tenantSubdomain: tenant.subdomain,
        customDomain: tenant.customDomain || null,
        recipientEmail,
        loginEmail,
        adminPassword,
      });

      return {
        success: true,
        message: `Tenant credentials email sent to ${recipientEmail}`,
        data: {
          tenantId: tenant.id,
          tenant: tenant.name,
          recipient: recipientEmail,
          login_email: loginEmail,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      const err = this.toError(error);
      this.logger.error(
        `❌ Failed to send tenant credentials for tenant ${id} to ${recipientEmail}: ${err.message}`,
      );
      throw new BadRequestException(`Unable to send tenant credentials email: ${err.message}`);
    }
  }

  private async rollbackTenantCreation(
    tenantName: string,
    dbName: string,
    tenantRecord: Tenant | null,
  ) {
    try {
      if (dbName) {
        await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        this.logger.warn(`⚠️ Rolled back database: ${dbName}`);
      }

      if (tenantRecord) {
        await this.tenantRepo.delete({ id: tenantRecord.id });
        this.logger.warn(`⚠️ Rolled back tenant metadata: ${tenantName}`);
      }
    } catch (rollbackError) {
      const err = this.toError(rollbackError);
      this.logger.error(`❌ Rollback failed for tenant "${tenantName}": ${err.message}`);
    }
  }

  private async bootstrapAdmin(
    connection: DataSource,
    admin: { name: string; email: string; password: string },
  ): Promise<IAdminSetup> {
    const userRepo = connection.getRepository(User);
    const roleRepo = connection.getRepository(Role);
    const permissionRepo = connection.getRepository(Permission);

    const defaultPermissions = [
      'create-user',
      'edit-user',
      'view-user',
      'delete-user',
      'create-role',
      'edit-role',
      'view-role',
      'delete-role',
      'create-job-position',
      'edit-job-position',
      'view-job-position',
      'delete-job-position',
      'create-location',
      'edit-location',
      'view-location',
      'delete-location',
      'create-vendor',
      'edit-vendor',
      'view-vendor',
      'delete-vendor',
      'create-reporting-group',
      'edit-reporting-group',
      'view-reporting-group',
      'delete-reporting-group',
      'create-reporting-category',
      'edit-reporting-category',
      'view-reporting-category',
      'delete-reporting-category',
      'create-item',
      'edit-item',
      'view-item',
      'delete-item',
      'create-permission',
      'edit-permission',
      'view-permission',
      'delete-permission',
      'create-form',
      'view-form',
      'edit-form',
      'delete-form',
      'publish-form',
      'submit-form',
      'create-dc-template',
      'view-dc-template',
      'edit-dc-template',
      'delete-dc-template',
      'activate-dc-template',
      'archive-dc-template',
      'view-dc-assignment',
      'complete-dc-assignment',
      'view-dc-submission',
      'review-dc-submission',
    ];

    const permissions = await Promise.all(
      defaultPermissions.map(async (permName) => {
        let perm = await permissionRepo.findOne({ where: { name: permName } });
        if (!perm) {
          perm = permissionRepo.create({ name: permName });
          await permissionRepo.save(perm);
        }
        return perm;
      }),
    );

    let adminRole = await roleRepo.findOne({
      where: { name: 'Admin' },
      relations: ['permissions'],
    });
    if (!adminRole) {
      adminRole = roleRepo.create({ name: 'Admin', permissions });
      await roleRepo.save(adminRole);
      this.logger.log(`🔑 Admin role created with default permissions`);
    } else {
      const existingPermissionNames = new Set((adminRole.permissions || []).map((p) => p.name));
      const merged = [...(adminRole.permissions || [])];

      for (const permission of permissions) {
        if (!existingPermissionNames.has(permission.name)) {
          merged.push(permission);
          existingPermissionNames.add(permission.name);
        }
      }

      adminRole.permissions = merged;
      await roleRepo.save(adminRole);
    }

    const employeePermissionNames = [
      'view-dc-assignment',
      'complete-dc-assignment',
      'view-dc-template',
      'submit-form',
      'view-item',
      'view-location',
      'view-job-position',
    ];
    const employeePermissions = permissions.filter((p) =>
      employeePermissionNames.includes(p.name),
    );

    let employeeRole = await roleRepo.findOne({
      where: { name: 'Employee' },
      relations: ['permissions'],
    });
    if (!employeeRole) {
      employeeRole = roleRepo.create({ name: 'Employee', permissions: employeePermissions });
      await roleRepo.save(employeeRole);
      this.logger.log(`🔑 Employee role created with assignment permissions`);
    } else {
      const existingPermissionNames = new Set((employeeRole.permissions || []).map((p) => p.name));
      const merged = [...(employeeRole.permissions || [])];
      for (const permission of employeePermissions) {
        if (!existingPermissionNames.has(permission.name)) {
          merged.push(permission);
          existingPermissionNames.add(permission.name);
        }
      }
      employeeRole.permissions = merged;
      await roleRepo.save(employeeRole);
    }

    const hashed = await argon2.hash(admin.password);

    const adminUser = userRepo.create({
      name: admin.name,
      email: admin.email,
      password: hashed,
      plainPassword: admin.password,
      role: adminRole,
      isSystem: true,
    });
    await userRepo.save(adminUser);

    this.logger.log(`👤 Admin user created: ${admin.email}`);

    return { role: adminRole, user: adminUser, plainPassword: admin.password };
  }

  private async bootstrapTenantFormBuilder(connection: DataSource, actorId: number | null): Promise<void> {
    const req = {
      tenantConnection: connection,
      user: actorId ? { id: actorId } : null,
    };
    const moduleRepo = connection.getRepository(DynamicModule);
    const formRepo = connection.getRepository(Form);
    const modules = FORM_BUILDER_MODULE_SEEDS;

    for (const moduleSeed of modules) {
      let moduleEntity = await moduleRepo.findOne({ where: { slug: moduleSeed.slug }, withDeleted: true });
      if (!moduleEntity) {
        moduleEntity = moduleRepo.create({
          slug: moduleSeed.slug,
          name: moduleSeed.name,
          isActive: true,
          createdBy: actorId,
          updatedBy: actorId,
        });
      } else {
        moduleEntity.name = moduleSeed.name;
        moduleEntity.isActive = true;
        moduleEntity.deletedAt = null;
        moduleEntity.updatedBy = actorId;
      }

      moduleEntity = await moduleRepo.save(moduleEntity);

      let form = await formRepo.findOne({
        where: { moduleId: moduleEntity.id },
        withDeleted: true,
        order: { createdAt: 'DESC' },
      });

      if (!form) {
        form = formRepo.create({
          moduleId: moduleEntity.id,
          name: `${moduleSeed.name} Form`,
          status: FormStatus.DRAFT,
          autosaveSchema: null,
          createdBy: actorId,
          updatedBy: actorId,
        });
        form = await formRepo.save(form);
      } else if (form.deletedAt) {
        form.deletedAt = null;
        form.status = FormStatus.DRAFT;
        form.updatedBy = actorId;
        form = await formRepo.save(form);
      }

      if (!moduleSeed.defaultFields?.length) {
        continue;
      }
      // If an autosave schema with fields already exists, don't overwrite it
      if (form.autosaveSchema && Array.isArray(form.autosaveSchema.fields) && form.autosaveSchema.fields.length) {
        continue;
      }

      form.autosaveSchema = {
        fields: moduleSeed.defaultFields.map((item, index) => ({
          id: item.id,
          fieldKey: item.key,
          label: item.label,
          name: item.name,
          fieldTypeName: item.type,
          placeholder: item.placeholder ?? 'Placeholder text',
          helpText: item.helpText ?? null,
          isRequired: item.isRequired ?? false,
          isEditable: item.isEditable ?? true,
          isUnique: item.isUnique ?? false,
          isReadonly: !(item.isEditable ?? true),
          isSystemField: item.isSystemField ?? false,
          systemMappingKey: item.isSystemField ? (item.systemMappingKey ?? item.key) : null,
          isShow: item.isShow ?? true,
          ...(item.optionSource ? { optionSource: item.optionSource } : {}),
          sortOrder: index,
          ...(item.type === 'dropdown' || item.options?.length
            ? {
                options: (item.options ?? []).map((option, sortOrder) => ({
                  label: option.label,
                  value: option.value,
                  isDefault: option.isDefault ?? false,
                  sortOrder,
                })),
              }
            : {}),
        })),
      };

      await formRepo.save(form);
    }

    this.logger.log('🧩 Form builder modules and default forms bootstrapped for new tenant');
  }

  protected buildResponse(
    tenant: Tenant,
    adminSetup?: IAdminSetup,
    subscription?: any,
    email?: { sent: boolean; recipients: string[]; error: string | null },
  ): ITenantResponse {
    if (!adminSetup) {
      throw new InternalServerErrorException('Admin setup missing.');
    }

    const { user, role } = adminSetup;

    return {
      success: true,
      message: `Tenant "${tenant.name}" created successfully`,
      data: {
        ...this.serializeTenant(tenant, {
          plan: subscription?.plan?.name ?? null,
          planId: subscription?.planId ?? null,
          subscriptionStatus: subscription?.status ?? null,
          billingCycle: subscription?.billingCycle ?? null,
          trialEndsAt: subscription?.trialEndsAt ?? null,
        }),
        database: tenant.dbName,
        subscription: subscription || null,
        stripe: {
          configured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
          customerId: subscription?.stripeCustomerId || null,
          subscriptionId: subscription?.stripeSubscriptionId || null,
        },
        credentialsEmail: {
          sent: email?.sent ?? false,
          recipients: email?.recipients ?? [],
          error: email?.error ?? null,
        },
        admin: {
          name: user.name || '',
          email: user.email || '',
          password: adminSetup.plainPassword,
          role: {
            id: role.id,
            name: role.name,
            permissions: role.permissions.map((p) => ({
              id: p.id,
              name: p.name,
            })),
          },
        },
      },
    };
  }

  async remove(id: number) {
    try {
      const tenant = await this.tenantRepo.findOneBy({ id });
      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${id} not found`);
      }

      const dbName = tenant.dbName;
      this.logger.log(`🧹 Preparing to delete tenant "${tenant.name}" and DB "${dbName}"`);

      if (tenantConnections[dbName]) {
        const conn = tenantConnections[dbName];
        if (conn.isInitialized) {
          await conn.destroy();
          this.logger.log(`🔌 Closed active connection for ${dbName}`);
        }
        delete tenantConnections[dbName];
      }

      try {
        await this.dataSource.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = '${dbName}'
                      AND pid <> pg_backend_pid();
                `);
        this.logger.log(`🔫 Terminated active sessions for ${dbName}`);
      } catch (terminateErr) {
        const err = this.toError(terminateErr);
        this.logger.warn(
          `⚠️ Could not terminate connections for ${dbName}: ${err.message}`,
        );
      }

      try {
        await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        this.logger.log(`🗑️ Database dropped: ${dbName}`);
      } catch (dropErr) {
        const err = this.toError(dropErr);
        this.logger.error(`❌ Failed to drop database ${dbName}:`, err.stack);
        throw new InternalServerErrorException(`Failed to drop database "${dbName}"`);
      }

      await this.tenantRepo.remove(tenant);
      this.logger.log(`✅ Tenant record removed: ${tenant.name}`);

      return {
        success: true,
        message: `Tenant "${tenant.name}" and its database "${dbName}" deleted successfully.`,
        deleted: {
          id: tenant.id,
          name: tenant.name,
          dbName,
        },
      };
    } catch (error) {
      const err = this.toError(error);
      this.logger.error(`❌ Tenant deletion failed: ${err.message}`, err.stack);

      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(`Failed to delete tenant: ${err.message}`);
    }
  }

  async bulkRemove(ids: number[]) {
    const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) {
      throw new BadRequestException('At least one valid ID is required');
    }

    const deleted: Array<{ id: number; name: string; dbName: string }> = [];

    for (const id of uniqueIds) {
      const result = await this.remove(id);
      deleted.push(result.deleted);
    }

    return {
      success: true,
      message: `${deleted.length} tenant(s) deleted successfully`,
      data: { deletedIds: deleted.map((item) => item.id), count: deleted.length, deleted },
    };
  }

  async update(id: number, dto: UpdateTenantDto) {
    try {
      const tenant = await this.tenantRepo.findOne({
        where: { id },
        relations: ['country', 'state'],
      });
      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${id} not found.`);
      }

      await this.assertLocation(
        dto.countryId !== undefined ? dto.countryId : tenant.countryId || undefined,
        dto.stateId !== undefined ? dto.stateId : tenant.stateId || undefined,
      );

      if (dto.name !== undefined) {
        const name = dto.name.trim();
        const taken = await this.tenantRepo.exists({ where: { name } });
        if (taken && name !== tenant.name) {
          throw new ConflictException(`Tenant "${name}" already exists`);
        }
        tenant.name = name;
      }

      if (dto.domain !== undefined) {
        const subdomain = this.domainToSubdomain(dto.domain);
        const taken = await this.tenantRepo.exists({ where: { subdomain } });
        if (taken && subdomain !== tenant.subdomain) {
          throw new ConflictException(`Domain "${dto.domain}" is already in use`);
        }
        tenant.subdomain = subdomain;
      }

      if (dto.email !== undefined) tenant.email = dto.email.trim().toLowerCase();
      if (dto.phoneCountryCode !== undefined) tenant.phoneCountryCode = dto.phoneCountryCode.trim() || null;
      if (dto.phoneNumber !== undefined) tenant.phoneNumber = dto.phoneNumber.trim() || null;
      if (dto.industry !== undefined) tenant.industry = dto.industry.trim() || null;
      if (dto.description !== undefined) tenant.description = dto.description.trim() || null;
      if (dto.countryId !== undefined) tenant.countryId = dto.countryId;
      if (dto.stateId !== undefined) tenant.stateId = dto.stateId;
      if (dto.city !== undefined) tenant.city = dto.city.trim() || null;
      if (dto.address !== undefined) tenant.address = dto.address.trim() || null;
      if (dto.postalCode !== undefined) tenant.postalCode = dto.postalCode.trim() || null;
      if (dto.customDomain !== undefined) tenant.customDomain = dto.customDomain.trim() || null;

      const saved = await this.tenantRepo.save(tenant).catch((dbError) => {
        this.logger.error(`❌ Database error while updating tenant ${id}: ${dbError.message}`, dbError.stack);
        throw new InternalServerErrorException('Database error while updating tenant.');
      });

      const refreshed = await this.tenantRepo.findOne({
        where: { id: saved.id },
        relations: ['country', 'state'],
      });
      const [serialized] = await this.withBilling([refreshed || saved]);

      return {
        success: true,
        message: `Tenant "${saved?.name}" updated successfully`,
        data: serialized,
      };
    } catch (error) {
      const err = this.toError(error);
      if (
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error(`❌ Failed to update tenant: ${err.message}`, err.stack);

      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred while updating tenant');
    }
  }
}
