import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { MasterAuthService } from './auth.service';

describe('MasterAuthService', () => {
  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  let service: MasterAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MasterAuthService(mockUserRepo as any, mockJwtService as any);
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
    mockJwtService.sign.mockReturnValue('jwt-token');

    const result = await service.login({ email: 'admin@system.com', password: 'Secret123' } as any);

    expect(result.success).toBe(true);
    expect(result.access_token).toBe('jwt-token');
    expect(result.user.email).toBe('admin@system.com');
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
});
