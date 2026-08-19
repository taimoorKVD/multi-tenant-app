import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Plan, PlanStatus, WebsiteSignup, WebsiteSignupStatus } from '../entities';
import { StripeService } from '../stripe.service';
import { BillingService } from '../billing.service';
import { TenantsService } from '../../tenants/tenants.service';
import { CreateTenantDto } from '../../tenants/dto';
import { StartWebsiteSignupDto } from './dto/start-website-signup.dto';
import { decryptMailSecret, encryptMailSecret } from '../../../mail/utils/mail-crypto.util';

@Injectable()
export class PublicSignupService {
  private readonly logger = new Logger(PublicSignupService.name);
  private readonly provisioning = new Set<string>();

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

    const synced = await this.syncPlanPrice(plan);
    if (!synced.stripePriceId) {
      throw new BadRequestException('This plan is not ready for payment. Contact support.');
    }

    const adminPassword = dto.admin.password;
    const payload = this.toStoredPayload(dto);
    const signup = await this.signupRepo.save(
      this.signupRepo.create({
        planId: plan.id,
        email: dto.email.trim().toLowerCase(),
        payload,
        adminPasswordEncrypted: encryptMailSecret(adminPassword) as string,
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
      priceId: synced.stripePriceId,
      customerEmail: dto.admin.email.trim().toLowerCase(),
      successUrl,
      cancelUrl,
      clientReferenceId: signup.id,
      trialDays,
      metadata: {
        signupId: signup.id,
        planId: String(plan.id),
      },
    });

    signup.stripeCheckoutSessionId = session.id;
    await this.signupRepo.save(signup);

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
          formattedPrice: undefined,
        },
      },
    };
  }

  async getStatus(sessionId: string) {
    const lookup = String(sessionId || '').trim();
    if (!lookup) throw new BadRequestException('session_id is required');

    const signup = await this.signupRepo.findOne({
      where: [{ stripeCheckoutSessionId: lookup }, { id: lookup }],
    });
    if (!signup) throw new NotFoundException('Signup session not found');

    return {
      success: true,
      data: {
        signupId: signup.id,
        status: signup.status,
        email: signup.email,
        tenantId: signup.tenantId,
        paid: [WebsiteSignupStatus.PAID, WebsiteSignupStatus.PROVISIONED].includes(signup.status),
        provisioned: signup.status === WebsiteSignupStatus.PROVISIONED,
        error: signup.status === WebsiteSignupStatus.FAILED ? signup.errorMessage : null,
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
    await this.signupRepo.save(signup);
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

  private toStoredPayload(dto: StartWebsiteSignupDto) {
    return {
      name: dto.name.trim(),
      domain: dto.domain.trim(),
      email: dto.email.trim().toLowerCase(),
      phoneCountryCode: dto.phoneCountryCode,
      phoneNumber: dto.phoneNumber,
      industry: dto.industry,
      description: dto.description,
      countryId: dto.countryId,
      stateId: dto.stateId,
      city: dto.city,
      address: dto.address,
      postalCode: dto.postalCode,
      planId: dto.planId,
      billingCycle: dto.billingCycle,
      trialDays: dto.trialDays,
      admin: {
        name: dto.admin.name.trim(),
        email: dto.admin.email.trim().toLowerCase(),
      },
    };
  }

  private toCreateTenantDto(signup: WebsiteSignup): CreateTenantDto {
    const payload = signup.payload || {};
    const admin = (payload.admin || {}) as { name?: string; email?: string };
    const password = decryptMailSecret(signup.adminPasswordEncrypted);
    if (!password) {
      throw new BadRequestException('Could not recover the admin password for this signup');
    }
    const dto = {
      name: String(payload.name || ''),
      domain: String(payload.domain || ''),
      email: String(payload.email || signup.email),
      phoneCountryCode: payload.phoneCountryCode as string | undefined,
      phoneNumber: payload.phoneNumber as string | undefined,
      industry: payload.industry as CreateTenantDto['industry'],
      description: payload.description as string | undefined,
      countryId: payload.countryId as number | undefined,
      stateId: payload.stateId as number | undefined,
      city: payload.city as string | undefined,
      address: payload.address as string | undefined,
      postalCode: payload.postalCode as string | undefined,
      planId: Number(payload.planId || signup.planId),
      billingCycle: payload.billingCycle as CreateTenantDto['billingCycle'],
      trialDays: payload.trialDays as number | undefined,
      admin: {
        name: String(admin.name || ''),
        email: String(admin.email || ''),
        password,
        confirmPassword: password,
      },
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
