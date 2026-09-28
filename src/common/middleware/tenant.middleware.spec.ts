import { TenantMiddleware } from './tenant.middleware';

describe('TenantMiddleware', () => {
  const mockTenantsService = {
    findOneFlexible: jest.fn(),
    getTenantConnection: jest.fn(),
    resolveTenantContext: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
    decode: jest.fn(),
  };

  let middleware: TenantMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new TenantMiddleware(mockTenantsService as any, mockJwtService as any);
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });
    mockJwtService.decode.mockReturnValue(null);
    mockTenantsService.resolveTenantContext.mockResolvedValue({
      tenant: { subdomain: 'test', timezone: null },
      connection: { options: { database: 'tenant_test' } },
    });
    mockTenantsService.getTenantConnection.mockResolvedValue({
      options: { database: 'tenant_test' },
    });
  });

  function createReq(url: string, email?: string) {
    return {
      method: 'POST',
      originalUrl: url,
      headers: { host: 'localhost:3000' },
      body: email ? { email } : {},
    } as any;
  }

  it('resolves tenant from email domain for forgot-password', async () => {
    const req = createReq('/api/forgot-password', 'admin@test.com');
    mockTenantsService.findOneFlexible
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ subdomain: 'test' });

    const next = jest.fn();
    await middleware.use(req, {} as any, next);

    expect(req.tenantId).toBe('test');
    expect(req.tenant).toBeDefined();
    expect(req.tenantConnection).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('resolves tenant from email domain for reset-password', async () => {
    const req = createReq('/api/reset-password', 'admin@test.com');
    mockTenantsService.findOneFlexible
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ subdomain: 'test' });

    const next = jest.fn();
    await middleware.use(req, {} as any, next);

    expect(req.tenantId).toBe('test');
    expect(next).toHaveBeenCalled();
  });

  it('resolves tenant from the email stored at tenant creation for login', async () => {
    const req = createReq('/api/login', 'omais.kv@gmail.com');
    mockTenantsService.findOneFlexible.mockResolvedValueOnce({ subdomain: 'acme' });
    mockTenantsService.resolveTenantContext.mockResolvedValueOnce({
      tenant: { subdomain: 'acme', timezone: 'Asia/Karachi' },
      connection: { options: { database: 'tenant_acme' } },
    });

    const next = jest.fn();
    await middleware.use(req, {} as any, next);

    expect(mockTenantsService.findOneFlexible).toHaveBeenCalledWith('omais.kv@gmail.com');
    expect(req.tenantId).toBe('acme');
    expect(req.tenant?.timezone).toBe('Asia/Karachi');
    expect(req.tenantConnection).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('allows forgot-password when tenant cannot be derived (temporary bypass)', async () => {
    const req = createReq('/api/forgot-password', 'admin@gmail.com');
    mockTenantsService.findOneFlexible.mockResolvedValue(null);

    const next = jest.fn();
    await middleware.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('allows forgot-password when derived tenant connection is not found (temporary bypass)', async () => {
    const req = createReq('/api/forgot-password', 'omais.kv@gmail.com');
    mockTenantsService.findOneFlexible.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockTenantsService.resolveTenantContext.mockRejectedValueOnce(
      new Error('Tenant not found for "gmail"'),
    );

    const next = jest.fn();
    await middleware.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });
});
