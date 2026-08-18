import { ForbiddenException } from '@nestjs/common';
import { PlanModulesGuard } from './plan-modules.guard';

describe('PlanModulesGuard', () => {
  const billingService = {
    getTenantEntitlements: jest.fn(),
  };
  const guard = new PlanModulesGuard(billingService as any);

  const createContext = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows master and unmatched routes', async () => {
    await expect(
      guard.canActivate(createContext({ originalUrl: '/api/master/plans', tenantId: 'acme' })),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(createContext({ originalUrl: '/api/login', tenantId: 'acme', tenantConnection: {} })),
    ).resolves.toBe(true);
  });

  it('blocks tenant APIs that are not on the current plan', async () => {
    billingService.getTenantEntitlements.mockResolvedValue({
      allowedModules: ['dashboard', 'users'],
      plan: { id: 1, name: 'Basic', slug: 'basic' },
      status: 'active',
    });

    await expect(
      guard.canActivate(
        createContext({
          originalUrl: '/api/data-collection/assignments',
          tenantId: 'acme',
          tenantConnection: {},
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows tenant APIs included in the plan', async () => {
    billingService.getTenantEntitlements.mockResolvedValue({
      allowedModules: ['dashboard', 'users', 'data-collection'],
      plan: { id: 2, name: 'Enterprise', slug: 'enterprise' },
      status: 'active',
    });

    await expect(
      guard.canActivate(
        createContext({
          originalUrl: '/api/data-collection/templates',
          tenantId: 'acme',
          tenantConnection: {},
        }),
      ),
    ).resolves.toBe(true);
  });
});
