import { PermissionSessionSyncService } from './permission-session-sync.service';
import { RealtimeEvents } from '../../realtime';

describe('PermissionSessionSyncService', () => {
  const authService = {
    revokeRefreshTokensForUsers: jest.fn().mockResolvedValue(undefined),
  };
  const realtimeService = {
    emitPermissionsChanged: jest.fn(),
  };

  let service: PermissionSessionSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermissionSessionSyncService(authService as any, realtimeService as any);
  });

  it('revokes refresh tokens and emits permissions.changed for unique user ids', async () => {
    const req = {
      tenantId: 'acme',
      tenantConnection: {},
    };

    await service.syncUsers(req as any, [1, 1, 2, 0, -3], {
      reason: 'job_position_permissions_updated',
      jobPositionId: 9,
    });

    expect(authService.revokeRefreshTokensForUsers).toHaveBeenCalledWith(req.tenantConnection, [
      1, 2,
    ]);
    expect(realtimeService.emitPermissionsChanged).toHaveBeenCalledWith('acme', [1, 2], {
      reason: 'job_position_permissions_updated',
      jobPositionId: 9,
      roleId: null,
    });
  });

  it('skips work when there are no valid user ids', async () => {
    await service.syncUsers({ tenantId: 'acme', tenantConnection: {} } as any, [], {
      reason: 'user_role_changed',
    });

    expect(authService.revokeRefreshTokensForUsers).not.toHaveBeenCalled();
    expect(realtimeService.emitPermissionsChanged).not.toHaveBeenCalled();
  });

  it('still emits when connection is missing but tenant slug exists', async () => {
    await service.syncUsers({ tenantId: 'acme' } as any, [5], {
      reason: 'user_job_position_changed',
      jobPositionId: 3,
    });

    expect(authService.revokeRefreshTokensForUsers).not.toHaveBeenCalled();
    expect(realtimeService.emitPermissionsChanged).toHaveBeenCalledWith(
      'acme',
      [5],
      expect.objectContaining({
        reason: 'user_job_position_changed',
        jobPositionId: 3,
      }),
    );
  });

  it('uses the permissions.changed event contract', () => {
    expect(RealtimeEvents.PERMISSIONS_CHANGED).toBe('permissions.changed');
    expect(RealtimeEvents.NOTIFICATION_CREATED).toBe('notification.created');
  });
});
