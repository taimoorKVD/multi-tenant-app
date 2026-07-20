import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: PermissionsGuard;

  function ctxWithRequest(request: any): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsGuard(reflector);
  });

  it('allows when no required permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);
    expect(guard.canActivate(ctxWithRequest({ user: {} }))).toBe(true);
  });

  it('allows when reflector returns null', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(null);
    expect(guard.canActivate(ctxWithRequest({ user: {} }))).toBe(true);
  });

  it('allows when user has required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['create-form']);
    const ctx = ctxWithRequest({ user: { permissions: ['create-form', 'view-form'] } });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when user lacks required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-form']);
    const ctx = ctxWithRequest({ user: { permissions: ['view-form'] } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies when request user is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-form']);
    expect(() => guard.canActivate(ctxWithRequest({ user: null }))).toThrow(ForbiddenException);
  });

  it('denies when request user is undefined', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-form']);
    expect(() => guard.canActivate(ctxWithRequest({}))).toThrow(ForbiddenException);
  });

  it('extracts permissions from role.permissions as objects', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['edit-form']);
    const ctx = ctxWithRequest({
      user: { role: { permissions: [{ name: 'edit-form' }, { name: 'view-form' }] } },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('extracts permissions from role.permissions as strings', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['edit-form']);
    const ctx = ctxWithRequest({
      user: { role: { permissions: ['edit-form', 'view-form'] } },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when role lacks required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-form']);
    const ctx = ctxWithRequest({ user: { role: { permissions: ['view-form'] } } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('prefers user.permissions over role.permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['create-form']);
    const ctx = ctxWithRequest({
      user: { permissions: ['create-form'], role: { permissions: [] } },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when user has no permissions or role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-form']);
    const ctx = ctxWithRequest({ user: { id: 1 } });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
