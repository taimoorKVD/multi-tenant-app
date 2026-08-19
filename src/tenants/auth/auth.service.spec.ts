import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TenantAuthService } from './auth.service';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from './entities';
import { User } from '../users/entities';

describe('TenantAuthService', () => {
  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };
  const mockBillingService = {
    getTenantEntitlements: jest.fn().mockResolvedValue({
      allowedModules: ['dashboard', 'users', 'roles', 'jobpositions', 'locations'],
      plan: { id: 1, name: 'Basic', slug: 'basic' },
      status: 'active',
    }),
  };

  let service: TenantAuthService;

  const createDeleteQueryBuilder = () => ({
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantAuthService(mockJwtService as any, mockBillingService as any);
  });

  function createReq(user: any, tenantId = 'test') {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest.fn().mockImplementation(async (entity: any) => entity),
    };
    const passwordResetTokenRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      createQueryBuilder: jest.fn(),
    };
    const emailVerificationTokenRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      createQueryBuilder: jest.fn(),
    };
    const refreshTokenRepo = {
      save: jest.fn().mockImplementation(async (entity: any) => entity),
      createQueryBuilder: jest.fn(),
    };

    return {
      tenantId,
      tenantConnection: {
        options: { database: `tenant_${tenantId}` },
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === User) return userRepo;
          if (entity === PasswordResetToken) return passwordResetTokenRepo;
          if (entity === EmailVerificationToken) return emailVerificationTokenRepo;
          if (entity === RefreshToken) return refreshTokenRepo;
          throw new Error(`Unexpected repository request: ${entity?.name}`);
        }),
      },
      _userRepo: userRepo,
      _passwordResetTokenRepo: passwordResetTokenRepo,
      _emailVerificationTokenRepo: emailVerificationTokenRepo,
      _refreshTokenRepo: refreshTokenRepo,
    } as any;
  }

  it('logs in tenant user with role permissions only', async () => {
    const req = createReq({
      id: 10,
      email: 'admin@test.com',
      password: 'hashed',
      name: 'Tenant Admin',
      role: {
        id: 1,
        name: 'Admin',
        permissions: [{ name: 'view-user' }, { name: 'edit-user' }],
      },
    });

    jest.spyOn(argon2, 'verify').mockResolvedValue(true as never);
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);
    jest
      .spyOn<any, any>(service as any, 'issueAuthTokens')
      .mockResolvedValue({ accessToken: 'tenant-jwt', refreshToken: 'refresh-jwt' });

    const result = await service.login(req, {
      email: 'admin@test.com',
      password: 'Secret123',
    });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('tenant-jwt');
    expect(result.user_type).toBe('tenant');
    expect(result.account_type).toBe('tenant_admin');
    expect(result.tenant_slug).toBe('test');
    expect(result.user.account_type).toBe('tenant_admin');
    expect(result.user.role.permissions).toEqual([{ name: 'view-user' }, { name: 'edit-user' }]);
    expect(result.user.email_verified).toBe(true);
  });

  it('throws when tenant connection is missing', async () => {
    await expect(
      service.login({ tenantConnection: null }, { email: 'x@test.com', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs in tenant user with the public email used at tenant creation', async () => {
    const req = createReq({
      id: 10,
      email: 'omais.kv@gmail.com',
      password: 'hashed',
      name: 'Tenant Admin',
      role: {
        id: 1,
        name: 'Admin',
        permissions: [{ name: 'view-user' }],
      },
    });

    jest.spyOn(argon2, 'verify').mockResolvedValue(true as never);
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);
    jest
      .spyOn<any, any>(service as any, 'issueAuthTokens')
      .mockResolvedValue({ accessToken: 'tenant-jwt', refreshToken: 'refresh-jwt' });

    const result = await service.login(req, {
      email: 'omais.kv@gmail.com',
      password: 'Secret123',
    });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('tenant-jwt');
    expect(result.user_type).toBe('tenant');
  });

  it('throws when tenant user is not found', async () => {
    const req = createReq(null);

    await expect(
      service.login(req, { email: 'missing@test.com', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns tenant profile for an active session', async () => {
    const user = {
      id: 10,
      email: 'admin@test.com',
      name: 'Tenant Admin',
      phoneNumber: '+923001234567',
      address: 'Office 1',
      username: 'tenant-admin',
      role: {
        id: 1,
        name: 'Admin',
        permissions: [{ id: 5, name: 'view-user' }],
      },
      jobPosition: { id: 2, name: 'Manager' },
      location: { id: 3, name: 'Karachi' },
      availabilityDays: ['monday', 'tuesday'],
      isSystem: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const req = createReq(user, 'kingdomvision');
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);

    const result = await service.getProfile(req, 10);

    expect(result.success).toBe(true);
    expect(result.user_type).toBe('tenant');
    expect(result.account_type).toBe('tenant_admin');
    expect(result.tenant_slug).toBe('kingdomvision');
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.user.email).toBe('admin@test.com');
    expect(result.user.account_type).toBe('tenant_admin');
    expect(result.user.email_verified).toBe(true);
    expect(result.user.role).toEqual({
      id: 1,
      name: 'Admin',
      permissions: [{ id: 5, name: 'view-user' }],
    });
  });

  it('throws when tenant password is invalid', async () => {
    const req = createReq({
      id: 10,
      email: 'admin@test.com',
      password: 'hashed',
      role: { name: 'Admin', permissions: [{ name: 'view-user' }] },
    });

    jest.spyOn(argon2, 'verify').mockResolvedValue(false as never);

    await expect(
      service.login(req, { email: 'admin@test.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('forgotPassword returns success for unknown tenant email', async () => {
    const req = createReq(null);
    req._userRepo.findOne.mockResolvedValue(null);

    const result = await service.forgotPassword(req, { email: 'missing@test.com' } as any);

    expect(result.success).toBe(true);
    expect(req._passwordResetTokenRepo.save).not.toHaveBeenCalled();
  });

  it('forgotPassword returns success when tenant connection is missing', async () => {
    const result = await service.forgotPassword(
      { tenantConnection: null },
      { email: 'omais.kv@gmail.com' } as any,
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('If the account exists');
  });

  it('forgotPassword does not throw when tenant reset email dispatch fails', async () => {
    const req = createReq({
      id: 1,
      email: 'admin@test.com',
      name: 'Tenant Admin',
    });
    req._passwordResetTokenRepo.createQueryBuilder.mockReturnValue(createDeleteQueryBuilder());
    jest.spyOn<any, any>(service as any, 'sendResetPasswordEmail').mockRejectedValue(new Error('smtp unavailable'));

    const result = await service.forgotPassword(req, { email: 'admin@test.com' } as any);

    expect(result.success).toBe(true);
    expect(req._passwordResetTokenRepo.save).toHaveBeenCalled();
  });

  it('verifyResetToken throws on invalid token', async () => {
    const req = createReq(null);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    req._passwordResetTokenRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.verifyResetToken(req, { email: 'admin@test.com', token: 'bad-token' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resetPassword updates hash and invalidates tenant token tables', async () => {
    const user = {
      id: 1,
      email: 'admin@test.com',
      password: 'old-hash',
    };
    const req = createReq(user);
    const selectQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ user }),
    };
    const resetDeleteQb = createDeleteQueryBuilder();
    const refreshDeleteQb = createDeleteQueryBuilder();
    req._passwordResetTokenRepo.createQueryBuilder
      .mockReturnValueOnce(selectQb)
      .mockReturnValueOnce(resetDeleteQb);
    req._refreshTokenRepo.createQueryBuilder.mockReturnValue(refreshDeleteQb);
    jest.spyOn(argon2, 'hash').mockResolvedValue('new-hash' as never);

    const result = await service.resetPassword(req, {
      email: 'admin@test.com',
      token: 'valid-token',
      password: 'NewStrongPassword123!',
      password_confirm: 'NewStrongPassword123!',
    } as any);

    expect(result.success).toBe(true);
    expect(user.password).toBe('new-hash');
    expect(req._userRepo.save).toHaveBeenCalledWith(user);
    expect(resetDeleteQb.execute).toHaveBeenCalled();
    expect(refreshDeleteQb.execute).toHaveBeenCalled();
  });

  it('sendEmailVerification returns success for unknown tenant email', async () => {
    const req = createReq(null);
    req._userRepo.findOne.mockResolvedValue(null);

    const result = await service.sendEmailVerification(req, { email: 'missing@test.com' } as any);

    expect(result.success).toBe(true);
    expect(req._emailVerificationTokenRepo.save).not.toHaveBeenCalled();
  });

  it('verifyEmail marks tenant email token as verified', async () => {
    const req = createReq({ id: 1, email: 'admin@test.com' });
    const token = {
      verifiedAt: null,
      user: { id: 1, email: 'admin@test.com' },
    };
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(token),
    };
    req._emailVerificationTokenRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.verifyEmail(req, {
      email: 'admin@test.com',
      token: 'valid-token',
    } as any);

    expect(result.success).toBe(true);
    expect(token.verifiedAt).toBeInstanceOf(Date);
    expect(req._emailVerificationTokenRepo.save).toHaveBeenCalledWith(token);
  });

  it('refreshToken rotates tenant access and refresh tokens', async () => {
    const user = {
      id: 1,
      email: 'admin@test.com',
      name: 'Tenant Admin',
      role: {
        name: 'Admin',
        permissions: [{ name: 'view-user' }],
      },
    };
    const req = createReq(user);
    const refreshQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ expiresAt: new Date(Date.now() + 1000) }),
    };
    req._refreshTokenRepo.createQueryBuilder.mockReturnValue(refreshQb);
    req._userRepo.findOne.mockResolvedValue(user);
    mockJwtService.verify.mockReturnValue({ sub: 1, type: 'refresh' });
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);
    jest
      .spyOn<any, any>(service as any, 'issueAuthTokens')
      .mockResolvedValue({ accessToken: 'tenant-access', refreshToken: 'tenant-refresh' });

    const result = await service.refreshToken(req, { refresh_token: 'tenant-refresh-token' } as any);

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('tenant-access');
    expect(result.refreshToken).toBe('tenant-refresh');
  });
});
