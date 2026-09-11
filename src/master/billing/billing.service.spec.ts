import { BillingCycle, PlanStatus, SubscriptionStatus } from './entities';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const planRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 1, ...value })),
    remove: jest.fn(),
    count: jest.fn(),
  };
  const subscriptionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const invoiceRepo = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };
  const tenantRepo = { findOne: jest.fn(), save: jest.fn(), count: jest.fn() };
  const stripeService = {
    isConfigured: jest.fn().mockReturnValue(false),
    getCurrency: jest.fn().mockReturnValue('eur'),
    toCents: jest.fn((value: number) => Math.round(value * 100)),
    fromCents: jest.fn((value: number) => value / 100),
    slugify: jest.fn((value: string) => value.toLowerCase()),
    ensureProductAndPrice: jest.fn(),
    unixToDate: jest.fn((value?: number | null) => (value ? new Date(value * 1000) : null)),
    cancelSubscriptionImmediately: jest.fn(),
  };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(
      planRepo as any,
      subscriptionRepo as any,
      invoiceRepo as any,
      tenantRepo as any,
      stripeService as any,
    );
  });

  it('lists serialized plans for Plan Management', async () => {
    planRepo.find.mockResolvedValue([
      {
        id: 1,
        name: 'Basic',
        slug: 'basic',
        description: null,
        priceCents: 25000,
        currency: 'EUR',
        billingCycle: BillingCycle.MONTHLY,
        usersLimit: 10,
        storageGb: 20,
        supportLevel: 'Email support',
        features: ['10 users'],
        trialDays: 14,
        sortOrder: 1,
        status: PlanStatus.ACTIVE,
        stripeProductId: null,
        stripePriceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await service.listPlans();
    expect(result.success).toBe(true);
    expect(result.data[0].name).toBe('Basic');
    expect(result.data[0].price).toBe(250);
    expect(result.data[0].formattedPrice).toBe('€250.00');
    expect(result.data[0].yearlyPrice).toBe(3000);
    expect(result.data[0].formattedYearlyPrice).toBe('€3000.00');
    expect(result.data[0].prices.yearly.amountCents).toBe(300000);
  });

  it('creates a local plan when Stripe is not configured', async () => {
    planRepo.findOne.mockResolvedValue(null);

    const result = await service.createPlan({
      name: 'Professional',
      price: 750,
    } as any);

    expect(result.success).toBe(true);
    expect(planRepo.save).toHaveBeenCalled();
    expect(stripeService.ensureProductAndPrice).not.toHaveBeenCalled();
    expect(result.data.allowedModules).toEqual(expect.arrayContaining(['dashboard', 'users']));
    expect(result.data.yearlyPrice).toBe(9000);
    expect(result.data.prices.monthly.amount).toBe(750);
  });

  it('stores the yearly amount when a subscription is created with yearly billing', async () => {
    tenantRepo.findOne.mockResolvedValue({
      id: 12,
      name: 'Acme',
      subdomain: 'acme',
      email: 'hello@acme.com',
      status: 'active',
    });
    planRepo.findOne.mockResolvedValue({
      id: 1,
      name: 'Basic',
      slug: 'basic',
      status: PlanStatus.ACTIVE,
      priceCents: 25000,
      yearlyPriceCents: 300000,
      currency: 'EUR',
      billingCycle: BillingCycle.MONTHLY,
      trialDays: 0,
    });
    subscriptionRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 9,
        tenantId: 12,
        planId: 1,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.YEARLY,
        amountCents: 300000,
        currency: 'EUR',
      });
    subscriptionRepo.save.mockImplementation(async (value) => ({ id: 9, ...value }));
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.createSubscription({
      tenantId: 12,
      planId: 1,
      billingCycle: BillingCycle.YEARLY,
      chargeNow: false,
    } as any);

    expect(subscriptionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 300000,
        billingCycle: BillingCycle.YEARLY,
      }),
    );
  });

  it('returns plan modules for an active tenant subscription', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 12, subdomain: 'acme', status: 'active' });
    subscriptionRepo.findOne.mockResolvedValue({
      status: SubscriptionStatus.ACTIVE,
      plan: {
        id: 1,
        name: 'Basic',
        slug: 'basic',
        modules: ['dashboard', 'users', 'items'],
      },
    });

    const result = await service.getTenantEntitlements('acme');
    expect(result.allowedModules).toEqual(['dashboard', 'users', 'items']);
    expect(result.plan).toEqual({ id: 1, name: 'Basic', slug: 'basic' });
  });

  function stripeEvent(type: string, object: Record<string, unknown>) {
    return { type, data: { object } } as any;
  }

  it('marks subscription cancelled and suspends tenant when Stripe deletes the subscription', async () => {
    const tenant = { id: 12, status: 'active' };
    const local = {
      id: 5,
      status: SubscriptionStatus.ACTIVE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);

    const result = await service.processStripeEvent(
      stripeEvent('customer.subscription.deleted', {
        id: 'sub_del',
        status: 'canceled',
        customer: 'cus_1',
        canceled_at: 1700000000,
        cancel_at_period_end: false,
        items: { data: [] },
      }),
    );

    expect(result).toEqual({ received: true, type: 'customer.subscription.deleted' });
    expect(local.status).toBe(SubscriptionStatus.CANCELLED);
    expect(tenant.status).toBe('suspended');
    expect(subscriptionRepo.save).toHaveBeenCalled();
    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
  });

  it('sends a billing email when a Stripe subscription is deleted', async () => {
    const tenant = { id: 12, status: 'active', email: 'hello@acme.com', name: 'Acme' };
    const local = {
      id: 5,
      status: SubscriptionStatus.ACTIVE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);
    const mail = { notify: jest.fn().mockResolvedValue(undefined), findSignupByCheckout: jest.fn() };
    service = new BillingService(
      planRepo as any,
      subscriptionRepo as any,
      invoiceRepo as any,
      tenantRepo as any,
      stripeService as any,
      undefined,
      mail as any,
    );

    await service.processStripeEvent(
      stripeEvent('customer.subscription.deleted', {
        id: 'sub_del',
        status: 'canceled',
        customer: 'cus_1',
        canceled_at: 1700000000,
        cancel_at_period_end: false,
        items: { data: [] },
      }),
    );

    expect(mail.notify).toHaveBeenCalledWith(
      'customer.subscription.deleted',
      expect.objectContaining({
        tenant,
        subscription: expect.objectContaining({ status: SubscriptionStatus.CANCELLED }),
      }),
    );
  });

  it('keeps tenant active on past_due but records the subscription status', async () => {
    const tenant = { id: 12, status: 'active' };
    const local = {
      id: 5,
      status: SubscriptionStatus.ACTIVE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.processStripeEvent(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'past_due',
        customer: 'cus_1',
        cancel_at_period_end: false,
        items: { data: [] },
      }),
    );

    expect(local.status).toBe(SubscriptionStatus.PAST_DUE);
    expect(tenant.status).toBe('active');
  });

  it('keeps tenant active when Stripe subscription is incomplete (awaiting payment)', async () => {
    const tenant = { id: 12, status: 'active' };
    const local = {
      id: 5,
      status: SubscriptionStatus.ACTIVE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.processStripeEvent(
      stripeEvent('customer.subscription.created', {
        id: 'sub_incomplete',
        status: 'incomplete',
        customer: 'cus_1',
        cancel_at_period_end: false,
        items: { data: [] },
      }),
    );

    expect(local.status).toBe(SubscriptionStatus.INCOMPLETE);
    expect(tenant.status).toBe('active');
  });

  it('suspends tenant when Stripe incomplete subscription expires', async () => {
    const tenant = { id: 12, status: 'active' };
    const local = {
      id: 5,
      status: SubscriptionStatus.INCOMPLETE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.processStripeEvent(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_expired',
        status: 'incomplete_expired',
        customer: 'cus_1',
        cancel_at_period_end: false,
        items: { data: [] },
      }),
    );

    expect(local.status).toBe(SubscriptionStatus.CANCELLED);
    expect(tenant.status).toBe('suspended');
  });

  it('records cancel-at-period-end from Stripe without suspending yet', async () => {
    const tenant = { id: 12, status: 'active' };
    const local = {
      id: 5,
      status: SubscriptionStatus.ACTIVE,
      tenant,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    };
    subscriptionRepo.findOne.mockResolvedValue(local);
    subscriptionRepo.save.mockImplementation(async (value) => value);
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.processStripeEvent(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_1',
        status: 'active',
        customer: 'cus_1',
        cancel_at_period_end: true,
        cancel_at: 1700000000,
        items: { data: [{ current_period_end: 1700000000 }] },
      }),
    );

    expect(local.cancelAtPeriodEnd).toBe(true);
    expect(local.status).toBe(SubscriptionStatus.ACTIVE);
    expect(tenant.status).toBe('active');
  });

  it('suspends tenant when Stripe customer is deleted', async () => {
    const tenant = { id: 9, status: 'active', stripeCustomerId: 'cus_gone' };
    tenantRepo.findOne.mockResolvedValue(tenant);
    tenantRepo.save.mockImplementation(async (value) => value);

    await service.processStripeEvent(stripeEvent('customer.deleted', { id: 'cus_gone' }));

    expect(tenant.status).toBe('suspended');
    expect(tenantRepo.save).toHaveBeenCalledWith(tenant);
  });

  it('upserts an invoice when Stripe reports payment failed', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 3,
        tenant: { id: 12, name: 'Acme', email: 'hello@acme.com' },
        subscription: { id: 5, plan: { name: 'Basic' } },
      });
    invoiceRepo.create.mockImplementation((value) => value);
    invoiceRepo.save.mockImplementation(async (value) => ({ id: 3, ...value }));
    subscriptionRepo.findOne.mockResolvedValue({
      id: 5,
      tenant: { id: 12, name: 'Acme', subdomain: 'acme' },
    });
    const invoiceQb = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    invoiceRepo.createQueryBuilder.mockReturnValue(invoiceQb);
    stripeService.unixToDate = jest.fn((value: number) => new Date(value * 1000));

    await service.processStripeEvent(
      stripeEvent('invoice.payment_failed', {
        id: 'in_fail',
        status: 'open',
        amount_due: 25000,
        amount_paid: 0,
        currency: 'usd',
        created: 1700000000,
        due_date: null,
        subscription: 'sub_1',
        customer: 'cus_1',
        number: 'INV-FAIL',
        hosted_invoice_url: null,
        invoice_pdf: null,
      }),
    );

    expect(invoiceRepo.save).toHaveBeenCalled();
    expect(invoiceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeInvoiceId: 'in_fail',
        tenantId: 12,
      }),
    );
  });

  it('delegates checkout.session.completed to public signup', async () => {
    const publicSignup = {
      completeFromCheckoutSession: jest.fn(),
      markCheckoutExpired: jest.fn(),
      markCheckoutFailed: jest.fn(),
    };
    service = new BillingService(
      planRepo as any,
      subscriptionRepo as any,
      invoiceRepo as any,
      tenantRepo as any,
      stripeService as any,
      publicSignup as any,
    );

    const session = { id: 'cs_test_1', payment_status: 'paid' };
    await service.processStripeEvent(stripeEvent('checkout.session.completed', session));
    expect(publicSignup.completeFromCheckoutSession).toHaveBeenCalledWith(session);

    await service.processStripeEvent(stripeEvent('checkout.session.expired', session));
    expect(publicSignup.markCheckoutExpired).toHaveBeenCalledWith(session);

    await service.processStripeEvent(stripeEvent('checkout.session.async_payment_failed', session));
    expect(publicSignup.markCheckoutFailed).toHaveBeenCalledWith(session);
  });

  it('acknowledges unknown Stripe events without throwing', async () => {
    const result = await service.processStripeEvent(stripeEvent('radar.early_fraud_warning.created', { id: 'issfr_1' }));
    expect(result).toEqual({ received: true, type: 'radar.early_fraud_warning.created' });
  });

  it('cancels non-cancelled Stripe subscriptions when a tenant is deleted', async () => {
    stripeService.isConfigured.mockReturnValue(true);
    subscriptionRepo.find.mockResolvedValue([
      {
        id: 1,
        tenantId: 12,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_active',
      },
    ]);

    await service.cancelSubscriptionsForTenantDeletion(12);

    expect(subscriptionRepo.find).toHaveBeenCalledWith({
      where: {
        tenantId: 12,
        status: expect.anything(),
      },
    });
    expect(stripeService.cancelSubscriptionImmediately).toHaveBeenCalledTimes(1);
    expect(stripeService.cancelSubscriptionImmediately).toHaveBeenCalledWith('sub_active');
  });

  it('skips Stripe cancellation when deleting a tenant without billable subscriptions', async () => {
    subscriptionRepo.find.mockResolvedValue([]);

    await service.cancelSubscriptionsForTenantDeletion(12);

    expect(stripeService.cancelSubscriptionImmediately).not.toHaveBeenCalled();
  });

  it('allows tenant deletion when Stripe is not configured', async () => {
    stripeService.isConfigured.mockReturnValue(false);
    subscriptionRepo.find.mockResolvedValue([
      {
        id: 1,
        tenantId: 12,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_active',
      },
    ]);

    await service.cancelSubscriptionsForTenantDeletion(12);

    expect(stripeService.cancelSubscriptionImmediately).not.toHaveBeenCalled();
  });
});
