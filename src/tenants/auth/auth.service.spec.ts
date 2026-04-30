import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TenantAuthService } from './auth.service';

describe('TenantAuthService', () => {
  const mockJwtService = {
    sign: jest.fn(),
  };

  let service: TenantAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantAuthService(mockJwtService as any);
  });

  function createReq(user: any, tenantId = 'test') {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(user),
    };

    return {
      tenantId,
      tenantConnection: {
        options: { database: `tenant_${tenantId}` },
        getRepository: jest.fn().mockReturnValue(userRepo),
      },
      _userRepo: userRepo,
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
    mockJwtService.sign.mockReturnValue('tenant-jwt');

    const result = await service.login(req, {
      email: 'admin@test.com',
      password: 'Secret123',
    });

    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('tenant-jwt');
    expect(result.tenant_slug).toBe('test');
    expect(result.user.role.permissions).toEqual([{ name: 'view-user' }, { name: 'edit-user' }]);

    expect(mockJwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: ['view-user', 'edit-user'] }),
      expect.any(Object),
    );
  });

  it('throws when tenant connection is missing', async () => {
    await expect(
      service.login({ tenantConnection: null }, { email: 'x@test.com', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when tenant user is not found', async () => {
    const req = createReq(null);

    await expect(
      service.login(req, { email: 'missing@test.com', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
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
});
