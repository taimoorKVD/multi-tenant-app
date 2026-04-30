import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantPermissionsGuard } from './tenant-permissions.guard';

describe('TenantPermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: TenantPermissionsGuard;

  function contextWithRequest(request: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new TenantPermissionsGuard(reflector);
  });

  it('allows when no required permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

    const ctx = contextWithRequest({
      tenantConnection: {},
      user: { permissions: [] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when user has required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-user']);

    const ctx = contextWithRequest({
      tenantConnection: {},
      user: { permissions: ['delete-user'] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when admin role lacks required permission (no hard bypass)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-user']);

    const ctx = contextWithRequest({
      tenantConnection: {},
      user: {
        email: 'admin@test.com',
        role: { name: 'Admin', permissions: [] },
        permissions: [],
      },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies when request user is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-user']);

    const ctx = contextWithRequest({
      tenantConnection: {},
      user: null,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
