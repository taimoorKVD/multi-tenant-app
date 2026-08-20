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
    invoiceRepo.findOne.mockResolvedValue(null);
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
});
