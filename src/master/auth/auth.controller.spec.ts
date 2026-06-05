import { MasterAuthController } from './auth.controller';

describe('MasterAuthController', () => {
  const mockAuthService = {
    login: jest.fn(),
    forgotPassword: jest.fn(),
    verifyResetToken: jest.fn(),
    resetPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    verifyEmail: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
    logout: jest.fn(),
  };

  let controller: MasterAuthController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MasterAuthController(mockAuthService as any);
  });

  it('returns authenticated master profile for /master/me', async () => {
    const profile = {
      id: 1,
      name: 'Super Admin',
      email: 'superadmin@system.com',
      role: 'Super Admin',
    };
    mockAuthService.getProfile.mockResolvedValue(profile);

    const result = await controller.getUser({
      user: { id: 1, email: 'superadmin@system.com', role: 'Super Admin' },
    } as any);

    expect(result).toBe(profile);
    expect(mockAuthService.getProfile).toHaveBeenCalledWith(1);
  });
});
