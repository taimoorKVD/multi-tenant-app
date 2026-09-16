import { lastValueFrom, of, throwError } from 'rxjs';
import { TenantAuditContextInterceptor } from './tenant-audit-context.interceptor';

describe('TenantAuditContextInterceptor', () => {
  function createFixture() {
    const repository = {};
    const manager = {
      getRepository: jest.fn().mockReturnValue(repository),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
    };
    const queryRunner = {
      manager,
      isReleased: false,
      connect: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockImplementation(async () => {
        queryRunner.isReleased = true;
      }),
    };
    const tenantConnection = {
      isInitialized: true,
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const req = {
      user: { id: 42 },
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.1' },
      tenantConnection,
    };
    const context = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(req),
      }),
    };

    return { context, manager, queryRunner, repository, req, tenantConnection };
  }

  it('scopes repositories to one connection and sets actor and client IP', async () => {
    const fixture = createFixture();
    const interceptor = new TenantAuditContextInterceptor();
    const next = {
      handle: jest.fn().mockImplementation(() => {
        expect(fixture.req.tenantConnection).not.toBe(fixture.tenantConnection);
        expect((fixture.req.tenantConnection as any).getRepository('User')).toBe(
          fixture.repository,
        );
        return of({ success: true });
      }),
    };

    await expect(
      lastValueFrom(interceptor.intercept(fixture.context as any, next)),
    ).resolves.toEqual({ success: true });

    expect(fixture.queryRunner.query.mock.calls[0][1]).toEqual([
      '42',
      '203.0.113.8',
    ]);
    expect(fixture.manager.getRepository).toHaveBeenCalledWith('User');
    expect(fixture.queryRunner.query).toHaveBeenCalledTimes(2);
    expect(fixture.queryRunner.release).toHaveBeenCalled();
    expect(fixture.req.tenantConnection).toBe(fixture.tenantConnection);
  });

  it('clears context and releases the connection when the handler fails', async () => {
    const fixture = createFixture();
    const interceptor = new TenantAuditContextInterceptor();
    const expectedError = new Error('request failed');
    const next = {
      handle: jest.fn().mockReturnValue(throwError(() => expectedError)),
    };

    await expect(
      lastValueFrom(interceptor.intercept(fixture.context as any, next)),
    ).rejects.toThrow(expectedError);

    expect(fixture.queryRunner.query).toHaveBeenCalledTimes(2);
    expect(fixture.queryRunner.release).toHaveBeenCalled();
    expect(fixture.req.tenantConnection).toBe(fixture.tenantConnection);
  });

  it('does not reserve a connection when no tenant is attached', async () => {
    const fixture = createFixture();
    fixture.req.tenantConnection = undefined as any;
    const interceptor = new TenantAuditContextInterceptor();
    const next = { handle: jest.fn().mockReturnValue(of('ok')) };

    await expect(
      lastValueFrom(interceptor.intercept(fixture.context as any, next)),
    ).resolves.toBe('ok');

    expect(fixture.tenantConnection.createQueryRunner).not.toHaveBeenCalled();
  });
});
