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
});
