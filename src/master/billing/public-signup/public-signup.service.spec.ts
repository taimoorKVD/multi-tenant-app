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
      admin: {
        name: 'Jane',
        email: 'jane@acme.com',
        password: 'Admin@123',
        confirmPassword: 'Admin@123',
      },
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
        admin: { name: 'Jane', email: 'jane@acme.com' },
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
        admin: expect.objectContaining({ email: 'jane@acme.com', password: 'Admin@123' }),
      }),
      { stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' },
    );
  });
});
