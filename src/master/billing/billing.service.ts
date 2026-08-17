import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Stripe from 'stripe';
import { Tenant } from '../tenants/entities';
import {
  BillingCycle,
  Invoice,
  InvoiceStatus,
  Plan,
  PlanStatus,
  Subscription,
  SubscriptionStatus,
} from './entities';
import {
  CancelSubscriptionDto,
  ChangePlanDto,
  CreatePlanDto,
  CreateSubscriptionDto,
  QueryInvoiceDto,
  QuerySubscriptionDto,
  UpdatePlanDto,
} from './dto';
import { StripeService } from './stripe.service';
import {
  ALL_PLAN_MODULE_KEYS,
  normalizePlanModules,
  PLAN_MODULES,
  serializePlanModules,
} from './plan-modules';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly stripeService: StripeService,
  ) {}

  private money(cents: number, currency = 'EUR') {
    return {
      amount: this.stripeService.fromCents(cents),
      amountCents: cents,
      formatted: `${this.formatCurrency(currency)}${this.stripeService.fromCents(cents).toFixed(2)}`,
      currency: currency.toUpperCase(),
    };
  }

  private formatCurrency(currency: string): string {
    const upper = currency.toUpperCase();
    if (upper === 'EUR') return '€';
    if (upper === 'USD') return '$';
    if (upper === 'GBP') return '£';
    return `${upper} `;
  }

  private serializePlan(plan: Plan) {
    const money = this.money(plan.priceCents, plan.currency);
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: money.amount,
      priceCents: plan.priceCents,
      formattedPrice: money.formatted,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      usersLimit: plan.usersLimit,
      storageGb: plan.storageGb,
      storage: plan.storageGb != null ? `${plan.storageGb} GB` : null,
      supportLevel: plan.supportLevel,
      features: plan.features || [],
      modules: serializePlanModules(plan.modules),
      allowedModules: normalizePlanModules(plan.modules),
      trialDays: plan.trialDays,
      sortOrder: plan.sortOrder,
      status: plan.status,
      stripeProductId: plan.stripeProductId,
      stripePriceId: plan.stripePriceId,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private serializeSubscription(subscription: Subscription) {
    const money = this.money(subscription.amountCents, subscription.currency);
    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      tenant: subscription.tenant
        ? {
            id: subscription.tenant.id,
            name: subscription.tenant.name,
            subdomain: subscription.tenant.subdomain,
            domain: subscription.tenant.customDomain || `${subscription.tenant.subdomain}.eusocial.com`,
            status: subscription.tenant.status || 'active',
          }
        : null,
      planId: subscription.planId,
      plan: subscription.plan
        ? {
            id: subscription.plan.id,
            name: subscription.plan.name,
            slug: subscription.plan.slug,
          }
        : null,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      amount: money.amount,
      amountCents: subscription.amountCents,
      formattedAmount: money.formatted,
      currency: subscription.currency,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBilling: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private serializeInvoice(invoice: Invoice) {
    const money = this.money(invoice.amountCents, invoice.currency);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      tenant: invoice.tenant
        ? {
            id: invoice.tenant.id,
            name: invoice.tenant.name,
            subdomain: invoice.tenant.subdomain,
          }
        : null,
      subscriptionId: invoice.subscriptionId,
      amount: money.amount,
      amountCents: invoice.amountCents,
      formattedAmount: money.formatted,
      currency: invoice.currency,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      hostedInvoiceUrl: invoice.hostedInvoiceUrl,
      invoicePdfUrl: invoice.invoicePdfUrl,
      stripeInvoiceId: invoice.stripeInvoiceId,
      createdAt: invoice.createdAt,
    };
  }

  private mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIAL,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELLED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.CANCELLED,
      paused: SubscriptionStatus.PAST_DUE,
    };
    return map[status] || SubscriptionStatus.INCOMPLETE;
  }

  private mapStripeInvoiceStatus(status: Stripe.Invoice.Status | null): InvoiceStatus {
    const map: Record<string, InvoiceStatus> = {
      draft: InvoiceStatus.DRAFT,
      open: InvoiceStatus.PENDING,
      paid: InvoiceStatus.PAID,
      uncollectible: InvoiceStatus.FAILED,
      void: InvoiceStatus.CANCELLED,
    };
    return (status && map[status]) || InvoiceStatus.PENDING;
  }

  private periodFromStripe(sub: Stripe.Subscription) {
    const item = sub.items?.data?.[0];
    return {
      start: this.stripeService.unixToDate(item?.current_period_start || (sub as any).current_period_start),
      end: this.stripeService.unixToDate(item?.current_period_end || (sub as any).current_period_end),
    };
  }

  private tenantEmail(tenant: Tenant): string {
    return tenant.email?.trim() || `billing@${tenant.subdomain}.eusocial.com`;
  }

  private async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.invoiceRepo
      .createQueryBuilder('invoice')
      .where(`invoice.invoiceNumber LIKE :prefix`, { prefix: `INV-${year}-%` })
      .getCount();
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async syncPlanToStripe(plan: Plan): Promise<Plan> {
    if (!this.stripeService.isConfigured()) return plan;
    const ids = await this.stripeService.ensureProductAndPrice(plan);
    plan.stripeProductId = ids.productId;
    plan.stripePriceId = ids.priceId;
    return this.planRepo.save(plan);
  }

  async listPlans() {
    const plans = await this.planRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    return {
      success: true,
      data: plans.map((plan) => this.serializePlan(plan)),
      count: plans.length,
    };
  }

  async getPlan(id: number) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return { success: true, data: this.serializePlan(plan) };
  }

  async createPlan(dto: CreatePlanDto) {
    const slug = this.stripeService.slugify(dto.slug || dto.name);
    const existing = await this.planRepo.findOne({ where: [{ name: dto.name }, { slug }] });
    if (existing) throw new BadRequestException('A plan with this name or slug already exists');

    const currency = (dto.currency || this.stripeService.getCurrency()).toUpperCase();
    let plan = this.planRepo.create({
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() || null,
      priceCents: this.stripeService.toCents(dto.price),
      currency,
      billingCycle: dto.billingCycle || BillingCycle.MONTHLY,
      usersLimit: dto.usersLimit ?? null,
      storageGb: dto.storageGb ?? null,
      supportLevel: dto.supportLevel?.trim() || null,
      features: dto.features || [],
      modules: normalizePlanModules(dto.modules),
      trialDays: dto.trialDays ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status || PlanStatus.ACTIVE,
    });
    plan = await this.planRepo.save(plan);
    plan = await this.syncPlanToStripe(plan);
    return { success: true, message: 'Plan created', data: this.serializePlan(plan) };
  }

  async updatePlan(id: number, dto: UpdatePlanDto) {
    let plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.slug !== undefined) plan.slug = this.stripeService.slugify(dto.slug);
    if (dto.description !== undefined) plan.description = dto.description?.trim() || null;
    if (dto.price !== undefined) plan.priceCents = this.stripeService.toCents(dto.price);
    if (dto.currency !== undefined) plan.currency = dto.currency.toUpperCase();
    if (dto.billingCycle !== undefined) plan.billingCycle = dto.billingCycle;
    if (dto.usersLimit !== undefined) plan.usersLimit = dto.usersLimit;
    if (dto.storageGb !== undefined) plan.storageGb = dto.storageGb;
    if (dto.supportLevel !== undefined) plan.supportLevel = dto.supportLevel?.trim() || null;
    if (dto.features !== undefined) plan.features = dto.features;
    if (dto.modules !== undefined) plan.modules = normalizePlanModules(dto.modules);
    if (dto.trialDays !== undefined) plan.trialDays = dto.trialDays;
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) plan.status = dto.status;

    plan = await this.planRepo.save(plan);
    plan = await this.syncPlanToStripe(plan);
    return { success: true, message: 'Plan updated', data: this.serializePlan(plan) };
  }

  async deletePlan(id: number) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    const activeSubs = await this.subscriptionRepo.count({
      where: {
        planId: id,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE]),
      },
    });
    if (activeSubs > 0) {
      throw new BadRequestException('Cannot delete a plan with active subscriptions. Deactivate it instead.');
    }
    await this.stripeService.archiveProduct(plan);
    await this.planRepo.remove(plan);
    return { success: true, message: 'Plan deleted' };
  }

  async listSubscriptions(query: QuerySubscriptionDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(query.limit || 15, 1), 100);
    const qb = this.subscriptionRepo
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.tenant', 'tenant')
      .leftJoinAndSelect('subscription.plan', 'plan')
      .orderBy('subscription.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) qb.andWhere('subscription.status = :status', { status: query.status });
    if (query.planId) qb.andWhere('subscription.planId = :planId', { planId: query.planId });
    if (query.tenant) {
      qb.andWhere('(tenant.name ILIKE :tenant OR tenant.subdomain ILIKE :tenant)', {
        tenant: `%${query.tenant}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    return {
      success: true,
      data: rows.map((row) => this.serializeSubscription(row)),
      meta: { total, page, lastPage: Math.ceil(total / limit) || 1 },
    };
  }

  async getSubscription(id: number) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['tenant', 'plan'],
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return { success: true, data: this.serializeSubscription(subscription) };
  }

  async getSubscriptionStats() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [active, cancelledThisMonth, mrrRows, paidInvoices] = await Promise.all([
      this.subscriptionRepo.count({
        where: { status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]) },
      }),
      this.subscriptionRepo
        .createQueryBuilder('subscription')
        .where('subscription.status = :status', { status: SubscriptionStatus.CANCELLED })
        .andWhere('subscription.cancelledAt >= :monthStart', { monthStart })
        .getCount(),
      this.subscriptionRepo
        .createQueryBuilder('subscription')
        .select('subscription.billingCycle', 'billingCycle')
        .addSelect('SUM(subscription.amountCents)', 'total')
        .where('subscription.status IN (:...statuses)', {
          statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
        })
        .groupBy('subscription.billingCycle')
        .getRawMany<{ billingCycle: BillingCycle; total: string }>(),
      this.invoiceRepo
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amountCents), 0)', 'total')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .getRawOne<{ total: string }>(),
    ]);

    let mrrCents = 0;
    for (const row of mrrRows) {
      const total = Number(row.total) || 0;
      mrrCents += row.billingCycle === BillingCycle.YEARLY ? Math.round(total / 12) : total;
    }
    const arrCents = mrrCents * 12;
    const lifetimeCents = Number(paidInvoices?.total) || 0;

    return {
      success: true,
      data: {
        activeSubscriptions: active,
        mrr: this.money(mrrCents),
        arr: this.money(arrCents),
        cancelledThisMonth,
        totalRevenue: this.money(lifetimeCents),
      },
    };
  }

  async createSubscription(dto: CreateSubscriptionDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: dto.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan || plan.status !== PlanStatus.ACTIVE) {
      throw new BadRequestException('Plan is not available');
    }

    const existing = await this.subscriptionRepo.findOne({
      where: {
        tenantId: tenant.id,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.PAST_DUE,
          SubscriptionStatus.INCOMPLETE,
        ]),
      },
    });
    if (existing) {
      throw new BadRequestException('Tenant already has an active or pending subscription');
    }

    const billingCycle = dto.billingCycle || plan.billingCycle;
    const trialDays = dto.trialDays ?? plan.trialDays;
    let stripeCustomerId = tenant.stripeCustomerId || null;
    let stripeSubscription: Stripe.Subscription | null = null;

    if (dto.chargeNow !== false && this.stripeService.isConfigured()) {
      const synced = await this.syncPlanToStripe(plan);
      stripeCustomerId = await this.stripeService.ensureCustomer({
        customerId: stripeCustomerId,
        name: tenant.name,
        email: this.tenantEmail(tenant),
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
      });
      tenant.stripeCustomerId = stripeCustomerId;
      await this.tenantRepo.save(tenant);

      if (!synced.stripePriceId) {
        throw new InternalServerErrorException('Stripe price is missing for this plan');
      }

      stripeSubscription = await this.stripeService.createSubscription({
        customerId: stripeCustomerId,
        priceId: synced.stripePriceId,
        trialDays,
        paymentMethodId: dto.paymentMethodId,
        metadata: {
          tenantId: String(tenant.id),
          planId: String(plan.id),
        },
      });
    }

    const period = stripeSubscription ? this.periodFromStripe(stripeSubscription) : { start: new Date(), end: null };
    const status = stripeSubscription
      ? this.mapStripeSubscriptionStatus(stripeSubscription.status)
      : trialDays > 0
        ? SubscriptionStatus.TRIAL
        : SubscriptionStatus.ACTIVE;

    const trialEndsAt =
      stripeSubscription?.trial_end
        ? this.stripeService.unixToDate(stripeSubscription.trial_end)
        : trialDays > 0
          ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000)
          : null;

    const saved = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({
        tenantId: tenant.id,
        planId: plan.id,
        status,
        billingCycle,
        amountCents: plan.priceCents,
        currency: plan.currency,
        trialEndsAt,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        stripeCustomerId,
        stripeSubscriptionId: stripeSubscription?.id || null,
      }),
    );

    tenant.status = status === SubscriptionStatus.TRIAL ? 'trial' : 'active';
    await this.tenantRepo.save(tenant);

    const withRelations = await this.subscriptionRepo.findOne({
      where: { id: saved.id },
      relations: ['tenant', 'plan'],
    });

    return {
      success: true,
      message: 'Subscription created',
      data: this.serializeSubscription(withRelations as Subscription),
      stripe: stripeSubscription
        ? {
            clientSecret:
              typeof stripeSubscription.latest_invoice === 'object'
                ? (stripeSubscription.latest_invoice as any)?.payment_intent?.client_secret || null
                : null,
            subscriptionId: stripeSubscription.id,
          }
        : null,
    };
  }

  async changePlan(id: number, dto: ChangePlanDto) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['tenant', 'plan'],
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (
      ![SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE].includes(
        subscription.status,
      )
    ) {
      throw new BadRequestException('Only active subscriptions can change plan');
    }

    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan || plan.status !== PlanStatus.ACTIVE) {
      throw new BadRequestException('Target plan is not available');
    }

    if (subscription.stripeSubscriptionId && this.stripeService.isConfigured()) {
      const synced = await this.syncPlanToStripe(plan);
      if (!synced.stripePriceId) {
        throw new InternalServerErrorException('Stripe price is missing for this plan');
      }
      const updated = await this.stripeService.changeSubscriptionPrice(
        subscription.stripeSubscriptionId,
        synced.stripePriceId,
        dto.prorate !== false,
      );
      const period = this.periodFromStripe(updated);
      subscription.status = this.mapStripeSubscriptionStatus(updated.status);
      subscription.currentPeriodStart = period.start;
      subscription.currentPeriodEnd = period.end;
    }

    subscription.planId = plan.id;
    subscription.plan = plan;
    subscription.amountCents = plan.priceCents;
    subscription.currency = plan.currency;
    subscription.billingCycle = plan.billingCycle;
    const saved = await this.subscriptionRepo.save(subscription);

    return {
      success: true,
      message: 'Subscription plan updated',
      data: this.serializeSubscription(saved),
    };
  }

  async cancelSubscription(id: number, dto: CancelSubscriptionDto) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['tenant', 'plan'],
    });
    if (!subscription) throw new NotFoundException('Subscription not found');

    const atPeriodEnd = dto.atPeriodEnd !== false;
    if (subscription.stripeSubscriptionId && this.stripeService.isConfigured()) {
      const updated = await this.stripeService.cancelSubscription(
        subscription.stripeSubscriptionId,
        atPeriodEnd,
      );
      const period = this.periodFromStripe(updated as Stripe.Subscription);
      subscription.currentPeriodEnd = period.end;
      if (atPeriodEnd) {
        subscription.cancelAtPeriodEnd = true;
        subscription.cancelAt = period.end;
      } else {
        subscription.status = SubscriptionStatus.CANCELLED;
        subscription.cancelledAt = new Date();
        if (subscription.tenant) {
          subscription.tenant.status = 'suspended';
          await this.tenantRepo.save(subscription.tenant);
        }
      }
    } else if (atPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelAt = subscription.currentPeriodEnd;
    } else {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
    }

    const saved = await this.subscriptionRepo.save(subscription);
    return {
      success: true,
      message: atPeriodEnd ? 'Subscription will cancel at period end' : 'Subscription cancelled',
      data: this.serializeSubscription(saved),
    };
  }

  async listInvoices(query: QueryInvoiceDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(Math.max(query.limit || 15, 1), 100);
    const qb = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.tenant', 'tenant')
      .leftJoinAndSelect('invoice.subscription', 'subscription')
      .orderBy('invoice.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) qb.andWhere('invoice.status = :status', { status: query.status });
    if (query.tenant) {
      qb.andWhere('(tenant.name ILIKE :tenant OR tenant.subdomain ILIKE :tenant)', {
        tenant: `%${query.tenant}%`,
      });
    }
    if (query.from) qb.andWhere('invoice.invoiceDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('invoice.invoiceDate <= :to', { to: query.to });

    const [rows, total] = await qb.getManyAndCount();
    return {
      success: true,
      data: rows.map((row) => this.serializeInvoice(row)),
      meta: { total, page, lastPage: Math.ceil(total / limit) || 1 },
    };
  }

  async getInvoice(id: number) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['tenant', 'subscription'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return { success: true, data: this.serializeInvoice(invoice) };
  }

  async getInvoiceStats() {
    const [paid, pending, overdue, revenue] = await Promise.all([
      this.invoiceRepo.count({ where: { status: InvoiceStatus.PAID } }),
      this.invoiceRepo.count({ where: { status: InvoiceStatus.PENDING } }),
      this.invoiceRepo.count({ where: { status: InvoiceStatus.OVERDUE } }),
      this.invoiceRepo
        .createQueryBuilder('invoice')
        .select('COALESCE(SUM(invoice.amountCents), 0)', 'total')
        .where('invoice.status = :status', { status: InvoiceStatus.PAID })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      success: true,
      data: {
        totalRevenue: this.money(Number(revenue?.total) || 0),
        paidInvoices: paid,
        pendingInvoices: pending,
        overdueInvoices: overdue,
      },
    };
  }

  async upsertInvoiceFromStripe(stripeInvoice: Stripe.Invoice) {
    const stripeInvoiceId = stripeInvoice.id;
    if (!stripeInvoiceId) return null;

    let invoice = await this.invoiceRepo.findOne({ where: { stripeInvoiceId } });
    const invoiceAny = stripeInvoice as Stripe.Invoice & {
      subscription?: string | { id?: string } | null;
      payment_intent?: string | { id?: string } | null;
    };
    const stripeSubId =
      typeof invoiceAny.subscription === 'string'
        ? invoiceAny.subscription
        : invoiceAny.subscription?.id || null;
    const subscription = stripeSubId
      ? await this.subscriptionRepo.findOne({
          where: { stripeSubscriptionId: stripeSubId },
          relations: ['tenant'],
        })
      : null;

    const customerId =
      typeof stripeInvoice.customer === 'string'
        ? stripeInvoice.customer
        : stripeInvoice.customer?.id || null;
    const tenant =
      subscription?.tenant ||
      (customerId
        ? await this.tenantRepo.findOne({ where: { stripeCustomerId: customerId } })
        : null);
    if (!tenant) {
      this.logger.warn(`Stripe invoice ${stripeInvoiceId} has no matching tenant`);
      return null;
    }

    const amountCents = stripeInvoice.amount_paid || stripeInvoice.amount_due || 0;
    const invoiceDate = this.stripeService.unixToDate(stripeInvoice.created);
    const dueDate = this.stripeService.unixToDate(stripeInvoice.due_date);

    if (!invoice) {
      invoice = this.invoiceRepo.create({
        invoiceNumber: stripeInvoice.number || (await this.nextInvoiceNumber()),
        tenantId: tenant.id,
        subscriptionId: subscription?.id || null,
        amountCents,
        currency: (stripeInvoice.currency || 'eur').toUpperCase(),
        status: this.mapStripeInvoiceStatus(stripeInvoice.status),
        invoiceDate: (invoiceDate || new Date()).toISOString().slice(0, 10),
        dueDate: dueDate ? dueDate.toISOString().slice(0, 10) : null,
        paidAt: stripeInvoice.status === 'paid' ? invoiceDate : null,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || null,
        invoicePdfUrl: stripeInvoice.invoice_pdf || null,
        stripeInvoiceId,
        stripePaymentIntentId:
          typeof invoiceAny.payment_intent === 'string'
            ? invoiceAny.payment_intent
            : invoiceAny.payment_intent?.id || null,
      });
    } else {
      invoice.status = this.mapStripeInvoiceStatus(stripeInvoice.status);
      invoice.amountCents = amountCents;
      invoice.hostedInvoiceUrl = stripeInvoice.hosted_invoice_url || invoice.hostedInvoiceUrl;
      invoice.invoicePdfUrl = stripeInvoice.invoice_pdf || invoice.invoicePdfUrl;
      invoice.paidAt = stripeInvoice.status === 'paid' ? invoice.paidAt || new Date() : invoice.paidAt;
      if (stripeInvoice.number) invoice.invoiceNumber = stripeInvoice.number;
    }

    if (invoice.status === InvoiceStatus.PENDING && dueDate && dueDate < new Date()) {
      invoice.status = InvoiceStatus.OVERDUE;
    }

    return this.invoiceRepo.save(invoice);
  }

  async applyStripeSubscription(stripeSub: Stripe.Subscription) {
    const local = await this.subscriptionRepo.findOne({
      where: { stripeSubscriptionId: stripeSub.id },
      relations: ['tenant', 'plan'],
    });
    if (!local) {
      this.logger.warn(`No local subscription for Stripe id ${stripeSub.id}`);
      return;
    }

    const period = this.periodFromStripe(stripeSub);
    local.status = this.mapStripeSubscriptionStatus(stripeSub.status);
    local.currentPeriodStart = period.start;
    local.currentPeriodEnd = period.end;
    local.cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
    local.cancelAt = this.stripeService.unixToDate(stripeSub.cancel_at);
    local.cancelledAt =
      stripeSub.status === 'canceled' ? this.stripeService.unixToDate(stripeSub.canceled_at) : local.cancelledAt;
    await this.subscriptionRepo.save(local);

    if (local.tenant) {
      if (local.status === SubscriptionStatus.CANCELLED || local.status === SubscriptionStatus.UNPAID) {
        local.tenant.status = 'suspended';
      } else if (local.status === SubscriptionStatus.TRIAL) {
        local.tenant.status = 'trial';
      } else {
        local.tenant.status = 'active';
      }
      await this.tenantRepo.save(local.tenant);
    }
  }

  async handleWebhook(rawBody: Buffer | string, signature: string) {
    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.applyStripeSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.updated':
        await this.upsertInvoiceFromStripe(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.debug(`Ignored Stripe event ${event.type}`);
    }

    return { received: true, type: event.type };
  }

  async getDashboardBilling() {
    const [subscriptionStats, invoiceStats, planCounts, activeTenants, trialTenants, suspendedTenants] =
      await Promise.all([
        this.getSubscriptionStats(),
        this.getInvoiceStats(),
        this.subscriptionRepo
          .createQueryBuilder('subscription')
          .leftJoin('subscription.plan', 'plan')
          .select('plan.name', 'name')
          .addSelect('plan.slug', 'slug')
          .addSelect('COUNT(*)', 'count')
          .where('subscription.status IN (:...statuses)', {
            statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
          })
          .groupBy('plan.name')
          .addGroupBy('plan.slug')
          .getRawMany<{ name: string; slug: string; count: string }>(),
        this.tenantRepo.count({ where: { status: 'active' } }),
        this.tenantRepo.count({ where: { status: 'trial' } }),
        this.tenantRepo.count({ where: { status: 'suspended' } }),
      ]);

    return {
      subscriptionStats: subscriptionStats.data,
      invoiceStats: invoiceStats.data,
      planCounts,
      tenantStatus: {
        active: activeTenants,
        trial: trialTenants,
        suspended: suspendedTenants,
      },
    };
  }

  listAvailableModules() {
    return {
      success: true,
      data: PLAN_MODULES,
      count: PLAN_MODULES.length,
    };
  }

  async getTenantEntitlements(tenantSlug: string) {
    const slug = String(tenantSlug || '').trim().toLowerCase();
    const tenant = await this.tenantRepo.findOne({
      where: [
        { subdomain: slug },
        { dbName: slug },
        { dbName: `tenant_${slug}` },
      ],
    });
    if (!tenant) {
      return {
        allowedModules: [...ALL_PLAN_MODULE_KEYS],
        plan: null,
        status: null,
      };
    }

    const subscription = await this.subscriptionRepo.findOne({
      where: {
        tenantId: tenant.id,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.TRIAL,
          SubscriptionStatus.PAST_DUE,
        ]),
      },
      relations: ['plan'],
      order: { id: 'DESC' },
    });

    if (!subscription?.plan) {
      return {
        allowedModules: [...ALL_PLAN_MODULE_KEYS],
        plan: null,
        status: tenant.status || null,
      };
    }

    return {
      allowedModules: normalizePlanModules(subscription.plan.modules),
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
      },
      status: subscription.status,
    };
  }

  async latestSubscriptionByTenantIds(tenantIds: number[]) {
    if (!tenantIds.length) return new Map<number, Subscription>();
    const rows = await this.subscriptionRepo.find({
      where: { tenantId: In(tenantIds) },
      relations: ['plan'],
      order: { id: 'DESC' },
    });
    const map = new Map<number, Subscription>();
    for (const row of rows) {
      if (!map.has(row.tenantId)) map.set(row.tenantId, row);
    }
    return map;
  }
}
