/**
 * Outbound Socket.IO event names.
 * Keep notification events here so the client contract stays stable as features grow.
 */
export const RealtimeEvents = {
  /** Effective permissions changed; client should call POST …/resync-session. */
  PERMISSIONS_CHANGED: 'permissions.changed',

  /** Reserved for in-app notifications (implement later). */
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_UPDATED: 'notification.updated',
  NOTIFICATION_READ: 'notification.read',
} as const;

export type RealtimeEventName = (typeof RealtimeEvents)[keyof typeof RealtimeEvents];
