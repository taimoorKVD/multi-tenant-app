import { JwtService } from '@nestjs/jwt';
import { encryptMailSecret } from '../../../mail/utils/mail-crypto.util';
import { WebsiteSignupStatus } from '../entities';
import { PublicSignupService } from './public-signup.service';

describe('PublicSignupService', () => {
  const signupRepo = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 'signup-1', ...value })),
    findOne: jest.fn(),
  };
  const planRepo = {
    findOne: jest.fn(),
    save: jest.fn(async (value) => value),
  };
  const stripeService = {
    isConfigured: jest.fn().mockReturnValue(true),
    fromCents: jest.fn((value: number) => Number(value || 0) / 100),
    ensureProductAndPrice: jest.fn().mockResolvedValue({
      productId: 'prod_1',
      priceId: 'price_month',
      yearlyPriceId: 'price_year',
    }),
    createCheckoutSession: jest.fn().mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    }),
  };
  const billingService = {
    listPublicPlans: jest.fn().mockResolvedValue({ success: true, data: [], count: 0 }),
    getTenantEntitlements: jest.fn().mockResolvedValue({
      plan: { id: 2, name: 'Standard', slug: 'standard' },
      allowedModules: ['dashboard', 'users'],
    }),
  };
  const tenantsService = {
    assertTenantAvailable: jest.fn().mockResolvedValue('acme'),
    getTenantHandoffLoginUrl: jest
      .fn()
      .mockImplementation((slug: string, ott: string) => `https://${slug}.eusocial.com/auth/handoff?ott=${ott}`),
    getTenantPortalContext: jest.fn().mockResolvedValue({
      subdomain: 'acme',
      customDomain: null,
      dbName: 'tenant_acme',
      email: 'hello@acme.com',
    }),
    create: jest.fn().mockResolvedValue({
      data: { id: 42, credentialsEmail: { error: null } },
    }),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt'),
  } as unknown as JwtService;

  let service: PublicSignupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicSignupService(
      signupRepo as any,
      planRepo as any,
      stripeService as any,
      billingService as any,
      tenantsService as any,
      jwtService,
    );
  });

  it('creates a Stripe Checkout session for a public website signup', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 2,
      name: 'Pro',
      slug: 'pro',
      status: 'active',
      trialDays: 0,
      currency: 'USD',
      priceCents: 25000,
      yearlyPriceCents: 300000,
      stripePriceId: 'price_month',
      stripeYearlyPriceId: 'price_year',
    });

    const result = await service.startCheckout({
      name: 'Acme',
      domain: 'acme.com',
      email: 'hello@acme.com',
      planId: 2,
    } as any);

    expect(tenantsService.assertTenantAvailable).toHaveBeenCalledWith('Acme', 'acme.com');
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ priceId: 'price_month' }),
    );
    expect(result.success).toBe(true);
    expect(result.data.plan.billingCycle).toBe('monthly');
    expect(result.data.plan.formattedPrice).toBe('$250.00');
    expect(result.data.checkoutUrl).toContain('checkout.stripe.com');
    expect(signupRepo.save).toHaveBeenCalled();
  });

  it('uses the yearly Stripe price when billingCycle is yearly', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 2,
      name: 'Pro',
      slug: 'pro',
      status: 'active',
      trialDays: 0,
      currency: 'USD',
      priceCents: 25000,
      yearlyPriceCents: 300000,
      stripePriceId: 'price_month',
      stripeYearlyPriceId: 'price_year',
    });

    const result = await service.startCheckout({
      name: 'Acme',
      domain: 'acme.com',
      email: 'hello@acme.com',
      planId: 2,
      billingCycle: 'yearly',
    } as any);

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: 'price_year',
        metadata: expect.objectContaining({ billingCycle: 'yearly' }),
      }),
    );
    expect(result.data.plan.billingCycle).toBe('yearly');
    expect(result.data.plan.priceCents).toBe(300000);
    expect(result.data.plan.formattedPrice).toBe('$3000.00');
  });

  it('provisions the tenant after Stripe Checkout is paid', async () => {
    signupRepo.findOne.mockResolvedValue({
      id: 'signup-1',
      planId: 2,
      email: 'hello@acme.com',
      status: WebsiteSignupStatus.PENDING,
      adminPasswordEncrypted: encryptMailSecret('Admin@123'),
      payload: {
        name: 'Acme',
        domain: 'acme.com',
        email: 'hello@acme.com',
        planId: 2,
      },
    });

    await service.completeFromCheckoutSession({
      id: 'cs_test_1',
      payment_status: 'paid',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { signupId: 'signup-1' },
    } as any);

    expect(tenantsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Acme',
        email: 'hello@acme.com',
      }),
      expect.objectContaining({
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        adminPassword: 'Admin@123',
      }),
    );
  });

  it('looks up status by Stripe checkout session id without treating it as a UUID', async () => {
    signupRepo.findOne.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: WebsiteSignupStatus.PENDING,
      email: 'hello@acme.com',
      tenantId: null,
      errorMessage: null,
      payload: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        email: 'hello@acme.com',
      },
    });

    const result = await service.getStatus('cs_test_a1b2c3');

    expect(signupRepo.findOne).toHaveBeenCalledWith({
      where: { stripeCheckoutSessionId: 'cs_test_a1b2c3' },
    });
    expect(result.data.status).toBe('pending');
    expect(result.data.provisioned).toBe(false);
    expect(result.data.email).toBe('hello@acme.com');
    expect(result.data.loginUrl).toBeNull();
    expect(result.data.oneTimeLoginToken).toBeNull();
    expect((result.data as any).password).toBeUndefined();
  });

  it('returns one-time login handoff after the tenant is provisioned', async () => {
    const signup = {
      id: '11111111-1111-4111-8111-111111111111',
      status: WebsiteSignupStatus.PROVISIONED,
      email: 'hello@acme.com',
      tenantId: 12,
      errorMessage: null,
      adminPasswordEncrypted: encryptMailSecret('K7m$pQ2nLx9w'),
      oneTimeLoginTokenHash: null,
      oneTimeLoginTokenExpiresAt: null,
      oneTimeLoginTokenUsedAt: null,
      payload: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        email: 'hello@acme.com',
      },
    };
    signupRepo.findOne.mockResolvedValue(signup);
    signupRepo.save.mockImplementation(async (value) => value);

    const result = await service.getStatus('cs_test_a1b2c3');

    expect(result.data.provisioned).toBe(true);
    expect(result.data.email).toBe('hello@acme.com');
    expect(result.data.oneTimeLoginToken).toEqual(expect.any(String));
    expect(result.data.oneTimeLoginToken!.length).toBeGreaterThan(16);
    expect(result.data.loginUrl).toContain('/auth/handoff?ott=');
    expect(result.data.loginUrl).toContain(result.data.oneTimeLoginToken!);
    expect((result.data as any).password).toBeUndefined();
    expect(tenantsService.getTenantPortalContext).toHaveBeenCalledWith(12);
    expect(tenantsService.getTenantHandoffLoginUrl).toHaveBeenCalled();
  });

  it('marks expired and failed checkout sessions', async () => {
    const pending = {
      id: 'signup-1',
      status: WebsiteSignupStatus.PENDING,
      errorMessage: null,
    };
    signupRepo.findOne.mockResolvedValue(pending);

    await service.markCheckoutExpired({ id: 'cs_exp', metadata: { signupId: 'signup-1' } } as any);
    expect(pending.status).toBe(WebsiteSignupStatus.EXPIRED);

    pending.status = WebsiteSignupStatus.PAID;
    await service.markCheckoutFailed({ id: 'cs_fail', metadata: { signupId: 'signup-1' } } as any);
    expect(pending.status).toBe(WebsiteSignupStatus.FAILED);
  });
});
