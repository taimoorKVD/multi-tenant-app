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
    ensureProductAndPrice: jest.fn().mockResolvedValue({ productId: 'prod_1', priceId: 'price_1' }),
    createCheckoutSession: jest.fn().mockResolvedValue({
      id: 'cs_test_1',
      url: 'https://checkout.stripe.com/c/pay/cs_test_1',
    }),
  };
  const billingService = {
    listPublicPlans: jest.fn().mockResolvedValue({ success: true, data: [], count: 0 }),
  };
  const tenantsService = {
    assertTenantAvailable: jest.fn().mockResolvedValue('acme'),
    getTenantLoginUrl: jest.fn().mockReturnValue('https://acme.eusocial.com/login'),
    getTenantLoginApiUrl: jest.fn().mockReturnValue('https://api.eusocial.com/api/tenant/acme/login'),
    getLoginUrlForTenant: jest.fn().mockResolvedValue('https://acme.eusocial.com/login'),
    getLoginApiUrlForTenant: jest.fn().mockResolvedValue({
      loginUrl: 'https://acme.eusocial.com/login',
      loginApiUrl: 'https://api.eusocial.com/api/tenant/acme/login',
      tenantSlug: 'acme',
    }),
    create: jest.fn().mockResolvedValue({
      data: { id: 42, credentialsEmail: { error: null } },
    }),
  };

  let service: PublicSignupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PublicSignupService(
      signupRepo as any,
      planRepo as any,
      stripeService as any,
      billingService as any,
      tenantsService as any,
    );
  });

  it('creates a Stripe Checkout session for a public website signup', async () => {
    planRepo.findOne.mockResolvedValue({
      id: 2,
      name: 'Pro',
      slug: 'pro',
      status: 'active',
      trialDays: 0,
      stripePriceId: 'price_1',
    });

    const result = await service.startCheckout({
      name: 'Acme',
      domain: 'acme.com',
      email: 'hello@acme.com',
      planId: 2,
    } as any);

    expect(tenantsService.assertTenantAvailable).toHaveBeenCalledWith('Acme', 'acme.com');
    expect(stripeService.createCheckoutSession).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.checkoutUrl).toContain('checkout.stripe.com');
    expect(signupRepo.save).toHaveBeenCalled();
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
    expect(result.data.password).toBeNull();
    expect(result.data.loginUrl).toBeNull();
    expect(result.data.loginApiUrl).toBeNull();
    expect(result.data.tenantSlug).toBeNull();
  });

  it('returns password and loginUrl after the tenant is provisioned', async () => {
    signupRepo.findOne.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      status: WebsiteSignupStatus.PROVISIONED,
      email: 'hello@acme.com',
      tenantId: 12,
      errorMessage: null,
      adminPasswordEncrypted: encryptMailSecret('K7m$pQ2nLx9w'),
      payload: {
        name: 'Acme Corporation',
        domain: 'acme.com',
        email: 'hello@acme.com',
      },
    });

    const result = await service.getStatus('cs_test_a1b2c3');

    expect(result.data.provisioned).toBe(true);
    expect(result.data.email).toBe('hello@acme.com');
    expect(result.data.password).toBe('K7m$pQ2nLx9w');
    expect(result.data.loginUrl).toBe('https://acme.eusocial.com/login');
    expect(result.data.loginApiUrl).toBe('https://api.eusocial.com/api/tenant/acme/login');
    expect(result.data.tenantSlug).toBe('acme');
    expect(tenantsService.getLoginApiUrlForTenant).toHaveBeenCalledWith(12);
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
