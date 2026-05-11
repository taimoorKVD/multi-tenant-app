import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { MasterAuthService } from './auth.service';

describe('MasterAuthService', () => {
  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockPasswordResetTokenRepo = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockEmailVerificationTokenRepo = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockRefreshTokenRepo = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  let service: MasterAuthService;

  const createDeleteQueryBuilder = () => ({
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MasterAuthService(
      mockUserRepo as any,
      mockPasswordResetTokenRepo as any,
      mockEmailVerificationTokenRepo as any,
      mockRefreshTokenRepo as any,
      mockJwtService as any,
    );
  });

  it('logs in a valid master user', async () => {
    const user = {
      id: 1,
      email: 'admin@system.com',
      password: 'hashed',
      name: 'Admin',
      role: { name: 'Super Admin', permissions: [] },
    };

    mockUserRepo.findOne.mockResolvedValue(user);
    jest.spyOn(argon2, 'verify').mockResolvedValue(true as never);
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);
    jest
      .spyOn<any, any>(service as any, 'issueAuthTokens')
      .mockResolvedValue({ access_token: 'jwt-token', refresh_token: 'refresh-token' });

    const result = await service.login({ email: 'admin@system.com', password: 'Secret123' } as any);

    expect(result.success).toBe(true);
    expect(result.access_token).toBe('jwt-token');
    expect(result.user.email).toBe('admin@system.com');
    expect(result.user.email_verified).toBe(true);
  });

  it('rejects invalid master credentials', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'wrong@system.com', password: 'bad' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns profile for valid user id', async () => {
    const user = {
      id: 1,
      name: 'Admin',
      email: 'admin@system.com',
      role: { name: 'Super Admin' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    mockUserRepo.findOne.mockResolvedValue(user);

    const profile = await service.getProfile(1);

    expect(profile.email).toBe('admin@system.com');
    expect(profile.role).toBe('Super Admin');
  });

  it('throws when profile user does not exist', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(service.getProfile(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forgotPassword returns success for unknown email (non-enumeration)', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@system.com' } as any);

    expect(result.success).toBe(true);
    expect(mockPasswordResetTokenRepo.save).not.toHaveBeenCalled();
  });

  it('forgotPassword does not throw when email dispatch fails', async () => {
    const user = {
      id: 1,
      email: 'admin@system.com',
      name: 'Admin',
    };

    mockUserRepo.findOne.mockResolvedValue(user);
    mockPasswordResetTokenRepo.createQueryBuilder.mockReturnValue(createDeleteQueryBuilder());
    mockPasswordResetTokenRepo.save.mockImplementation(async (entity: any) => entity);
    jest.spyOn<any, any>(service as any, 'sendResetPasswordEmail').mockRejectedValue(new Error('smtp unavailable'));

    const result = await service.forgotPassword({ email: 'admin@system.com' } as any);

    expect(result.success).toBe(true);
    expect(mockPasswordResetTokenRepo.save).toHaveBeenCalled();
  });

  it('verifyResetToken throws when token is invalid', async () => {
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    mockPasswordResetTokenRepo.createQueryBuilder.mockReturnValue(qb);

    await expect(
      service.verifyResetToken({ email: 'admin@system.com', token: 'bad-token' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resetPassword updates hash and clears token tables', async () => {
    const user = {
      id: 1,
      email: 'admin@system.com',
      password: 'old-hash',
    };
    const token = { user };
    const selectQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(token),
    };
    const resetDeleteQb = createDeleteQueryBuilder();
    const refreshDeleteQb = createDeleteQueryBuilder();

    mockPasswordResetTokenRepo.createQueryBuilder
      .mockReturnValueOnce(selectQb)
      .mockReturnValueOnce(resetDeleteQb);
    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(refreshDeleteQb);
    mockUserRepo.save.mockImplementation(async (entity: any) => entity);
    jest.spyOn(argon2, 'hash').mockResolvedValue('new-hash' as never);

    const result = await service.resetPassword({
      email: 'admin@system.com',
      token: 'valid-token',
      password: 'NewStrongPassword123!',
      password_confirm: 'NewStrongPassword123!',
    } as any);

    expect(result.success).toBe(true);
    expect(user.password).toBe('new-hash');
    expect(mockUserRepo.save).toHaveBeenCalledWith(user);
    expect(resetDeleteQb.execute).toHaveBeenCalled();
    expect(refreshDeleteQb.execute).toHaveBeenCalled();
  });

  it('sendEmailVerification returns success for unknown email', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const result = await service.sendEmailVerification({ email: 'missing@system.com' } as any);

    expect(result.success).toBe(true);
    expect(mockEmailVerificationTokenRepo.save).not.toHaveBeenCalled();
  });

  it('verifyEmail marks email token as verified', async () => {
    const token = {
      verifiedAt: null,
      user: { id: 1, email: 'admin@system.com' },
    };
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(token),
    };
    mockEmailVerificationTokenRepo.createQueryBuilder.mockReturnValue(qb);
    mockEmailVerificationTokenRepo.save.mockImplementation(async (entity: any) => entity);

    const result = await service.verifyEmail({
      email: 'admin@system.com',
      token: 'valid-token',
    } as any);

    expect(result.success).toBe(true);
    expect(token.verifiedAt).toBeInstanceOf(Date);
    expect(mockEmailVerificationTokenRepo.save).toHaveBeenCalledWith(token);
  });

  it('refreshToken rotates access and refresh tokens', async () => {
    const storedToken = {
      expiresAt: new Date(Date.now() + 60_000),
    };
    const refreshQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(storedToken),
    };
    const user = {
      id: 1,
      email: 'admin@system.com',
      name: 'Admin',
      role: { name: 'Super Admin', permissions: [] },
    };

    mockRefreshTokenRepo.createQueryBuilder.mockReturnValue(refreshQb);
    mockUserRepo.findOne.mockResolvedValue(user);
    mockJwtService.verify.mockReturnValue({ sub: 1, type: 'refresh' });
    jest.spyOn<any, any>(service as any, 'isEmailVerified').mockResolvedValue(true);
    jest
      .spyOn<any, any>(service as any, 'issueAuthTokens')
      .mockResolvedValue({ access_token: 'new-access', refresh_token: 'new-refresh' });

    const result = await service.refreshToken({ refresh_token: 'refresh-token' } as any);

    expect(result.success).toBe(true);
    expect(result.access_token).toBe('new-access');
    expect(result.refresh_token).toBe('new-refresh');
  });
});
