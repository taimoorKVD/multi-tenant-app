import { UnauthorizedException } from '@nestjs/common';
import { TenantAuthController } from './auth.controller';

describe('TenantAuthController', () => {
  const mockAuthService = {
    login: jest.fn(),
    forgotPassword: jest.fn(),
    verifyResetToken: jest.fn(),
    resetPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    verifyEmail: jest.fn(),
    refreshToken: jest.fn(),
    resyncSession: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn(),
  };

  let controller: TenantAuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TenantAuthController(mockAuthService as any);
  });

  it('returns authenticated tenant profile for /me', async () => {
    const session = {
      success: true,
      message: 'Session is active.',
      tenant_slug: 'kingdomvision',
      user: {
        id: 10,
        email: 'admin@kingdomvision.com',
      },
    };
    const req = {
      user: { sub: 10, email: 'admin@kingdomvision.com' },
      tenantId: 'kingdomvision',
    };
    mockAuthService.getProfile.mockResolvedValue(session);

    const result = await controller.me(req);

    expect(result).toBe(session);
    expect(mockAuthService.getProfile).toHaveBeenCalledWith(req, 10);
  });

  it('rejects /me when JWT payload has no user id', async () => {
    await expect(controller.me({ user: { email: 'admin@kingdomvision.com' } } as any))
      .rejects
      .toBeInstanceOf(UnauthorizedException);
  });

  it('resyncs session permissions for authenticated user', async () => {
    const session = {
      success: true,
      message: 'Session permissions resynced successfully.',
      accessToken: 'a',
      refreshToken: 'r',
    };
    const req = { user: { sub: 10 }, tenantId: 'acme' };
    mockAuthService.resyncSession.mockResolvedValue(session);

    const result = await controller.resyncSession(req);

    expect(result).toBe(session);
    expect(mockAuthService.resyncSession).toHaveBeenCalledWith(req, 10);
  });
});
