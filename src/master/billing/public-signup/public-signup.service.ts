import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Plan, PlanStatus, WebsiteSignup, WebsiteSignupStatus, BillingCycle } from '../entities';
import { StripeService } from '../stripe.service';
import { BillingService } from '../billing.service';
import { TenantsService } from '../../tenants/tenants.service';
import { CreateTenantDto } from '../../tenants/dto';
import { StartWebsiteSignupDto } from './dto/start-website-signup.dto';
import { decryptMailSecret, encryptMailSecret } from '../../../mail/utils/mail-crypto.util';
import { toSubdomainSlug } from '../../../utils';
import { getTenantDataSource } from '../../../database/datasource';
import { User } from '../../../tenants/users/entities';
import { RefreshToken } from '../../../tenants/auth/entities';
import { serializePlanModules } from '../plan-modules';
import {
  amountCentsForBillingCycle,
  stripePriceIdForBillingCycle,
} from '../plan-pricing';
import * as crypto from 'crypto';

@Injectable()
export class PublicSignupService {
  private readonly logger = new Logger(PublicSignupService.name);
  private readonly provisioning = new Set<string>();
  private readonly ottTtlMinutes = Number(process.env.SIGNUP_OTT_TTL_MINUTES || 15);
  private readonly accessTokenTtl = process.env.JWT_ACCESS_TOKEN_TTL || '2h';
  private readonly refreshTokenTtlDays = Number(process.env.JWT_REFRESH_TOKEN_TTL_DAYS || 7);

  constructor(
    @InjectRepository(WebsiteSignup)
    private readonly signupRepo: Repository<WebsiteSignup>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly stripeService: StripeService,
    @Inject(forwardRef(() => BillingService))
    private readonly billingService: BillingService,
    @Inject(forwardRef(() => TenantsService))
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
  ) {}

  listPlans() {
    return this.billingService.listPublicPlans();
  }

  async startCheckout(dto: StartWebsiteSignupDto) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY before accepting website payments.',
      );
    }

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan || plan.status !== PlanStatus.ACTIVE) {
      throw new BadRequestException('Selected plan is not available');
    }

    await this.tenantsService.assertTenantAvailable(dto.name, dto.domain);

    const billingCycle = dto.billingCycle || BillingCycle.MONTHLY;
    const synced = await this.syncPlanPrice(plan);
    const priceId = stripePriceIdForBillingCycle(synced, billingCycle);
    if (!priceId) {
      throw new BadRequestException('This plan is not ready for payment. Contact support.');
    }

    const businessEmail = dto.email.trim().toLowerCase();
    const payload = this.toStoredPayload({ ...dto, billingCycle });
    const signup = await this.signupRepo.save(
      this.signupRepo.create({
        planId: plan.id,
        email: businessEmail,
        payload,
        adminPasswordEncrypted: encryptMailSecret(this.generateAdminPassword()) as string,
        status: WebsiteSignupStatus.PENDING,
      }),
    );

    const websiteBase = this.websiteBaseUrl();
    const successUrl = this.normalizeSuccessUrl(dto.successUrl, websiteBase);
    const cancelUrl = dto.cancelUrl?.trim() || `${websiteBase}/signup/cancel`;
    this.assertHttpUrl(successUrl.replace('{CHECKOUT_SESSION_ID}', 'cs_placeholder'), 'successUrl');
    this.assertHttpUrl(cancelUrl, 'cancelUrl');
    const trialDays = dto.trialDays ?? plan.trialDays;

    const session = await this.stripeService.createCheckoutSession({
      priceId,
      customerEmail: businessEmail,
      successUrl,
      cancelUrl,
      clientReferenceId: signup.id,
      trialDays,
      metadata: {
        signupId: signup.id,
        planId: String(plan.id),
        billingCycle,
      },
    });

    signup.stripeCheckoutSessionId = session.id;
    await this.signupRepo.save(signup);

    const amountCents = amountCentsForBillingCycle(plan, billingCycle);
    const amount = this.stripeService.fromCents(amountCents);
    const currency = String(plan.currency || 'USD').toUpperCase();
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : `${currency} `;

    return {
      success: true,
      message: 'Continue to Stripe Checkout to complete payment.',
      data: {
        signupId: signup.id,
        sessionId: session.id,
        checkoutUrl: session.url,
        plan: {
          id: plan.id,
          name: plan.name,
          slug: plan.slug,
          billingCycle,
          priceCents: amountCents,
          formattedPrice: `${symbol}${amount.toFixed(2)}`,
        },
      },
    };
  }

  async getStatus(sessionId: string) {
    const lookup = String(sessionId || '').trim();
    if (!lookup) throw new BadRequestException('session_id is required');

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const signup = uuidPattern.test(lookup)
      ? await this.signupRepo.findOne({
          where: [{ id: lookup }, { stripeCheckoutSessionId: lookup }],
        })
      : await this.signupRepo.findOne({
          where: { stripeCheckoutSessionId: lookup },
        });
    if (!signup) throw new NotFoundException('Signup session not found');

    const payload = (signup.payload || {}) as {
      name?: string;
      email?: string;
    };
    const email =
      String(payload.email || signup.email || '')
        .trim()
        .toLowerCase() || null;
    const provisioned = signup.status === WebsiteSignupStatus.PROVISIONED;

    let loginUrl: string | null = null;
    let oneTimeLoginToken: string | null = null;
    let tenantSlug: string | null = null;

    if (provisioned && signup.tenantId) {
      const portal = await this.tenantsService.getTenantPortalContext(signup.tenantId);
      if (portal) {
        tenantSlug = portal.subdomain;
        oneTimeLoginToken = await this.issueOneTimeLoginToken(signup);
        loginUrl = this.tenantsService.getTenantHandoffLoginUrl(
          portal.subdomain,
          oneTimeLoginToken,
          portal.customDomain,
        );
      }
    } else if (provisioned) {
      const subdomain = toSubdomainSlug(String(payload.name || ''));
      if (subdomain) {
        tenantSlug = subdomain;
        oneTimeLoginToken = await this.issueOneTimeLoginToken(signup);
        loginUrl = this.tenantsService.getTenantHandoffLoginUrl(subdomain, oneTimeLoginToken);
      }
    }

    return {
      success: true,
      data: {
        signupId: signup.id,
        status: signup.status,
        email,
        loginUrl,
        oneTimeLoginToken,
        tenantSlug,
        tenantId: signup.tenantId,
        paid: [WebsiteSignupStatus.PAID, WebsiteSignupStatus.PROVISIONED].includes(signup.status),
        provisioned,
        error: signup.status === WebsiteSignupStatus.FAILED ? signup.errorMessage : null,
      },
    };
  }

  async completeHandoff(token: string, req?: any) {
    const raw = String(token || '').trim();
    if (!raw) throw new BadRequestException('token is required');

    const tokenHash = this.hashToken(raw);
    const signup = await this.signupRepo.findOne({
      where: { oneTimeLoginTokenHash: tokenHash },
    });
    if (!signup || signup.status !== WebsiteSignupStatus.PROVISIONED || !signup.tenantId) {
      throw new UnauthorizedException('Invalid or expired one-time login token');
    }
    if (signup.oneTimeLoginTokenUsedAt) {
      throw new UnauthorizedException('One-time login token has already been used');
    }
    if (
      !signup.oneTimeLoginTokenExpiresAt ||
      new Date(signup.oneTimeLoginTokenExpiresAt).getTime() < Date.now()
    ) {
      throw new UnauthorizedException('One-time login token has expired');
    }

    const portal = await this.tenantsService.getTenantPortalContext(signup.tenantId);
    if (!portal) {
      throw new UnauthorizedException('Tenant not found for this signup');
    }

    const email =
      String((signup.payload as any)?.email || signup.email || '')
        .trim()
        .toLowerCase() || null;
    if (!email) {
      throw new UnauthorizedException('Signup email is missing');
    }

    signup.oneTimeLoginTokenUsedAt = new Date();
    signup.oneTimeLoginTokenHash = null;
    signup.oneTimeLoginTokenExpiresAt = null;
    await this.signupRepo.save(signup);

    const tenantConnection = await getTenantDataSource(portal.dbName);
    const userRepo = tenantConnection.getRepository(User);
    const user = await userRepo.findOne({
      where: { email },
      relations: ['role', 'role.permissions', 'jobPosition'],
    });
    if (!user) {
      throw new UnauthorizedException('Tenant admin user not found');
    }

    const permissionNames = (user.role?.permissions || []).map((p) => p.name);
    const accountType = this.resolveAccountType(user.role?.name, permissionNames);
    const authReq = { ...(req || {}), tenantId: portal.subdomain, tenantConnection };
    const tokens = await this.issueAuthTokens(
      tenantConnection,
      authReq,
      user,
      permissionNames,
      accountType,
    );
    const entitlements = await this.billingService.getTenantEntitlements(portal.subdomain);

    return {
      success: true,
      message: 'Login successful',
      user_type: 'tenant',
      account_type: accountType,
      tenant_slug: portal.subdomain,
      tenant: tenantConnection.options.database,
      plan: entitlements.plan,
      allowedModules: entitlements.allowedModules,
      modules: serializePlanModules(entitlements.allowedModules),
      redirectTo: '/user-dashboard',
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        account_type: accountType,
        role: {
          id: user.role?.id,
          name: user.role?.name,
          permissions: user.role?.permissions || [],
        },
      },
    };
  }

  async completeFromCheckoutSession(session: Stripe.Checkout.Session) {
    const signup = await this.findSignupFromSession(session);
    if (!signup) {
      this.logger.warn(`No website signup for checkout session ${session.id}`);
      return;
    }

    if (signup.status === WebsiteSignupStatus.PROVISIONED) {
      return;
    }

    const paid =
      session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
    if (!paid) {
      this.logger.warn(`Checkout session ${session.id} is not paid (${session.payment_status})`);
      return;
    }

    if (this.provisioning.has(signup.id)) {
      return;
    }
    this.provisioning.add(signup.id);

    try {
      const customerId = this.asId(session.customer);
      const subscriptionId = this.asId(session.subscription);
      if (!customerId || !subscriptionId) {
        throw new BadRequestException('Stripe Checkout did not return a customer or subscription');
      }

      signup.stripeCustomerId = customerId;
      signup.stripeSubscriptionId = subscriptionId;
      signup.stripeCheckoutSessionId = session.id;
      signup.status = WebsiteSignupStatus.PAID;
      await this.signupRepo.save(signup);

      const dto = this.toCreateTenantDto(signup);
      const created = await this.tenantsService.create(dto, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        adminPassword: decryptMailSecret(signup.adminPasswordEncrypted) || undefined,
      });

      signup.tenantId = created.data.id;
      signup.status = WebsiteSignupStatus.PROVISIONED;
      signup.errorMessage = created.data.credentialsEmail?.error || null;
      await this.signupRepo.save(signup);
      this.logger.log(`Website signup ${signup.id} provisioned tenant ${created.data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create tenant after payment';
      signup.status = WebsiteSignupStatus.FAILED;
      signup.errorMessage = message;
      await this.signupRepo.save(signup);
      this.logger.error(`Website signup ${signup.id} provision failed: ${message}`);
      throw error;
    } finally {
      this.provisioning.delete(signup.id);
    }
  }

  async markCheckoutExpired(session: Stripe.Checkout.Session) {
    const signup = await this.findSignupFromSession(session);
    if (!signup || signup.status !== WebsiteSignupStatus.PENDING) return;
    signup.status = WebsiteSignupStatus.EXPIRED;
    signup.errorMessage = 'Stripe Checkout session expired before payment';
    await this.signupRepo.save(signup);
  }

  async markCheckoutFailed(session: Stripe.Checkout.Session) {
    const signup = await this.findSignupFromSession(session);
    if (!signup || signup.status === WebsiteSignupStatus.PROVISIONED) return;
    signup.status = WebsiteSignupStatus.FAILED;
    signup.errorMessage = 'Stripe Checkout payment failed';
    await this.signupRepo.save(signup);
  }

  private async issueOneTimeLoginToken(signup: WebsiteSignup): Promise<string> {
    const raw = crypto.randomBytes(32).toString('base64url');
    signup.oneTimeLoginTokenHash = this.hashToken(raw);
    signup.oneTimeLoginTokenExpiresAt = new Date(Date.now() + this.ottTtlMinutes * 60 * 1000);
    signup.oneTimeLoginTokenUsedAt = null;
    await this.signupRepo.save(signup);
    return raw;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private resolveAccountType(
    roleName: string | undefined,
    permissionNames: string[],
  ): 'tenant_admin' | 'tenant_user' {
    const name = String(roleName || '').trim().toLowerCase();
    if (name === 'admin' || name.includes('admin') || name.includes('manager') || name.includes('owner')) {
      return 'tenant_admin';
    }
    const adminHints = [
      'create-user',
      'edit-user',
      'create-role',
      'create-dc-template',
      'edit-dc-template',
      'activate-dc-template',
      'archive-dc-template',
      'review-dc-submission',
    ];
    if (adminHints.some((hint) => permissionNames.includes(hint))) {
      return 'tenant_admin';
    }
    return 'tenant_user';
  }

  private getRefreshTokenSecret(): string {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'tenant_default_secret';
  }

  private async issueAuthTokens(
    tenantConnection: any,
    req: any,
    user: User,
    permissionNames: string[],
    accountType: 'tenant_admin' | 'tenant_user',
  ) {
    const payload = {
      sub: user.id,
      userType: 'tenant',
      accountType,
      tenantId: req?.tenantId || null,
      tenantDb: tenantConnection?.options?.database,
      email: user.email,
      role: user.role?.name,
      jobPositionId: user.jobPosition?.id ?? null,
      permissions: permissionNames,
      emailVerified: true,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: this.accessTokenTtl as any,
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: `${this.refreshTokenTtlDays}d` as any,
      },
    );

    const refreshRepo = tenantConnection.getRepository(RefreshToken);
    await refreshRepo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('revoked_at IS NULL')
      .execute();

    await refreshRepo.save({
      user,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
      revokedAt: null,
      deviceName: null,
      ipAddress: null,
      userAgent: null,
    });

    return {
      accessToken,
      refreshToken,
      expires_in: this.accessTokenTtl,
      refresh_expires_in_days: this.refreshTokenTtlDays,
    };
  }

  private async findSignupFromSession(session: Stripe.Checkout.Session) {
    const signupId = session.metadata?.signupId || session.client_reference_id || '';
    if (signupId) {
      const byId = await this.signupRepo.findOne({ where: { id: signupId } });
      if (byId) return byId;
    }
    if (session.id) {
      return this.signupRepo.findOne({ where: { stripeCheckoutSessionId: session.id } });
    }
    return null;
  }

  private async syncPlanPrice(plan: Plan): Promise<Plan> {
    const ids = await this.stripeService.ensureProductAndPrice(plan);
    plan.stripeProductId = ids.productId;
    plan.stripePriceId = ids.priceId;
    plan.stripeYearlyPriceId = ids.yearlyPriceId;
    return this.planRepo.save(plan);
  }

  private assertHttpUrl(url: string, field: string) {
    if (!/^https?:\/\//i.test(String(url || '').trim())) {
      throw new BadRequestException(`${field} must be an http(s) URL`);
    }
  }

  private websiteBaseUrl() {
    return (
      process.env.PUBLIC_WEBSITE_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:4200'
    ).replace(/\/$/, '');
  }

  private normalizeSuccessUrl(input: string | undefined, websiteBase: string) {
    const fallback = `${websiteBase}/signup/success?session_id={CHECKOUT_SESSION_ID}`;
    const value = String(input || fallback).trim() || fallback;
    if (!value.includes('{CHECKOUT_SESSION_ID}')) {
      const separator = value.includes('?') ? '&' : '?';
      return `${value}${separator}session_id={CHECKOUT_SESSION_ID}`;
    }
    return value;
  }

  private generateAdminPassword(length = 12): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const special = '@$!%*?&';
    const all = upper + lower + digits + special;
    const pick = (set: string) => set[crypto.randomInt(set.length)];
    const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
    while (chars.length < length) {
      chars.push(pick(all));
    }
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }

  private toStoredPayload(dto: StartWebsiteSignupDto) {
    return {
      name: dto.name.trim(),
      domain: dto.domain.trim(),
      email: dto.email.trim().toLowerCase(),
      phoneCountryCode: dto.phoneCountryCode,
      phoneNumber: dto.phoneNumber,
      description: dto.description,
      countryId: dto.countryId,
      stateId: dto.stateId,
      city: dto.city,
      address: dto.address,
      postalCode: dto.postalCode,
      planId: dto.planId,
      billingCycle: dto.billingCycle,
      trialDays: dto.trialDays,
    };
  }

  private toCreateTenantDto(signup: WebsiteSignup): CreateTenantDto {
    const payload = signup.payload || {};
    const dto = {
      name: String(payload.name || ''),
      domain: String(payload.domain || ''),
      email: String(payload.email || signup.email),
      phoneCountryCode: payload.phoneCountryCode as string | undefined,
      phoneNumber: payload.phoneNumber as string | undefined,
      description: payload.description as string | undefined,
      countryId: payload.countryId as number | undefined,
      stateId: payload.stateId as number | undefined,
      city: payload.city as string | undefined,
      address: payload.address as string | undefined,
      postalCode: payload.postalCode as string | undefined,
      planId: Number(payload.planId || signup.planId),
      billingCycle: payload.billingCycle as CreateTenantDto['billingCycle'],
      trialDays: payload.trialDays as number | undefined,
    };
    return dto as CreateTenantDto;
  }

  private asId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'id' in (value as { id?: string })) {
      return String((value as { id: string }).id);
    }
    return null;
  }
}
