import { RealtimeService } from './realtime.service';
import { RealtimeEvents } from '../constants/realtime-events';
import { tenantUserRoom } from '../constants/realtime-rooms';

describe('RealtimeService', () => {
  let service: RealtimeService;
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RealtimeService();
    service.attachServer({ to } as any);
  });

  it('emits permissions.changed to each user room', () => {
    service.emitPermissionsChanged('acme', [10, 10, 11], {
      reason: 'job_position_permissions_updated',
      jobPositionId: 4,
    });

    expect(to).toHaveBeenCalledWith(tenantUserRoom('acme', 10));
    expect(to).toHaveBeenCalledWith(tenantUserRoom('acme', 11));
    expect(emit).toHaveBeenCalledWith(
      RealtimeEvents.PERMISSIONS_CHANGED,
      expect.objectContaining({
        action: 'resync_session',
        reason: 'job_position_permissions_updated',
        jobPositionId: 4,
        roleId: null,
      }),
    );
  });

  it('emits notification.created for future notification module', () => {
    service.emitNotificationCreated('acme', 7, {
      id: 99,
      title: 'Hello',
      body: 'World',
    });

    expect(to).toHaveBeenCalledWith(tenantUserRoom('acme', 7));
    expect(emit).toHaveBeenCalledWith(
      RealtimeEvents.NOTIFICATION_CREATED,
      expect.objectContaining({
        id: 99,
        title: 'Hello',
        body: 'World',
      }),
    );
  });
});
