import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataCollectionPermissionsGuard } from './data-collection-permissions.guard';

describe('DataCollectionPermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: DataCollectionPermissionsGuard;

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
    guard = new DataCollectionPermissionsGuard(reflector);
  });

  it('allows when no required permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);

    const ctx = contextWithRequest({
      user: { permissions: [] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when reflector returns null/undefined', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(null);

    const ctx = contextWithRequest({
      user: { permissions: [] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows when user has required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['create-dc-template']);

    const ctx = contextWithRequest({
      user: { permissions: ['create-dc-template', 'view-dc-template'] },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when user lacks required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-dc-template']);

    const ctx = contextWithRequest({
      user: { permissions: ['view-dc-template'] },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies when request user is missing', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-dc-template']);

    const ctx = contextWithRequest({
      user: null,
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies when request user is undefined', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-dc-template']);

    const ctx = contextWithRequest({});

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('extracts permissions from role.permissions as objects', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['edit-dc-template']);

    const ctx = contextWithRequest({
      user: {
        role: {
          permissions: [{ name: 'edit-dc-template' }, { name: 'view-dc-template' }],
        },
      },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('extracts permissions from role.permissions as strings', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['edit-dc-template']);

    const ctx = contextWithRequest({
      user: {
        role: {
          permissions: ['edit-dc-template', 'view-dc-template'],
        },
      },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when role lacks required permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['delete-dc-template']);

    const ctx = contextWithRequest({
      user: {
        role: { permissions: ['view-dc-template'] },
      },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('prefers user.permissions over role.permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['create-dc-template']);

    const ctx = contextWithRequest({
      user: {
        permissions: ['create-dc-template'],
        role: { permissions: [] },
      },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns empty array for permissions when user has no permissions or role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['view-dc-template']);

    const ctx = contextWithRequest({
      user: { id: 1 },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
