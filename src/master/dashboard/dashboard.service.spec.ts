import { DashboardService } from './dashboard.service';

const createQueryBuilder = (rows: Array<{ key: string; count: string | number }> = []) => ({
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
  getRawOne: jest.fn().mockResolvedValue({ avgMs: '128', total: '10', failed: '0' }),
});

describe('Master DashboardService', () => {
  const mockTenantRepo = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };
  const mockUserRepo = {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockActivityLogRepo = {
    createQueryBuilder: jest.fn(),
  };
  const mockEmailLogRepo = {
    count: jest.fn(),
  };
  const mockMailSettingRepo = {
    findOne: jest.fn(),
  };
  const mockBillingService = {
    getDashboardBilling: jest.fn(),
    latestSubscriptionByTenantIds: jest.fn(),
  };

  let service: DashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTenantRepo.createQueryBuilder.mockReturnValue(createQueryBuilder());
    mockUserRepo.createQueryBuilder.mockReturnValue(createQueryBuilder());
    mockActivityLogRepo.createQueryBuilder.mockReturnValue(createQueryBuilder());
    mockTenantRepo.query.mockResolvedValue([{ '?column?': 1 }]);
    mockEmailLogRepo.count.mockResolvedValue(0);
    mockMailSettingRepo.findOne.mockResolvedValue({ id: 1, isActive: true, host: 'smtp.example.com' });
    mockBillingService.getDashboardBilling.mockResolvedValue({
      subscriptionStats: {
        activeSubscriptions: 0,
        mrr: { amount: 0, currency: 'EUR' },
      },
      invoiceStats: { totalRevenue: { amount: 0, currency: 'EUR' } },
      planCounts: [],
      tenantStatus: { active: 12, trial: 0, suspended: 0 },
    });
    mockBillingService.latestSubscriptionByTenantIds.mockResolvedValue(new Map());

    service = new DashboardService(
      mockTenantRepo as any,
      mockUserRepo as any,
      mockActivityLogRepo as any,
      mockEmailLogRepo as any,
      mockMailSettingRepo as any,
      mockBillingService as any,
    );

    jest.spyOn(service as any, 'countTenantUsers').mockResolvedValue(24);
  });

  it('returns Super Admin dashboard sections for the home design', async () => {
    mockTenantRepo.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(10);
    mockUserRepo.count.mockResolvedValueOnce(4).mockResolvedValueOnce(1);
    mockTenantRepo.find.mockResolvedValue([
      {
        id: 12,
        name: 'Acme Corporation',
        subdomain: 'acme',
        dbName: 'tenant_acme',
        customDomain: null,
        createdAt: new Date('2026-08-10T09:00:00.000Z'),
      },
    ]);

    const result = await service.getDashboard();

    expect(result.success).toBe(true);
    expect(result.user_type).toBe('master');
    expect(result.data.kpis.totalTenants.value).toBe(12);
    expect(result.data.kpis.totalTenants.change).toBe(2);
    expect(result.data.kpis.totalTenants.available).toBe(true);
    expect(result.data.kpis.activeTenants.value).toBe(12);
    expect(result.data.kpis.totalUsers.value).toBe(4);
    expect(result.data.kpis.mrr.available).toBe(true);
    expect(result.data.kpis.activeSubscriptions.available).toBe(true);
    expect(result.data.kpis.platformRevenue.available).toBe(true);
    expect(result.data.tenantsOverview.period).toBe('this_month');
    expect(result.data.tenantsOverview.summary.newTenants).toBe(2);
    expect(result.data.planDistribution.available).toBe(true);
    expect(result.data.recentTenants[0]).toMatchObject({
      name: 'Acme Corporation',
      subdomain: 'acme',
      status: 'Active',
      users: 24,
      plan: null,
    });
    expect(result.data.systemHealth.database.status).toBe('healthy');
    expect(result.data.systemHealth.email.status).toBe('healthy');
    expect(result.data.systemHealth.storage.available).toBe(false);
  });
});
