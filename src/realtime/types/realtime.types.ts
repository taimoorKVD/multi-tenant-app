import { RealtimeEvents } from '../constants/realtime-events';

export type PermissionsChangedReason =
  | 'job_position_permissions_updated'
  | 'user_job_position_changed'
  | 'user_role_changed'
  | 'role_permissions_updated';

export interface PermissionsChangedPayload {
  /** Client should call authenticated POST …/resync-session (refresh tokens were revoked). */
  action: 'resync_session';
  reason: PermissionsChangedReason;
  jobPositionId?: number | null;
  roleId?: number | null;
  at: string;
}

export interface NotificationCreatedPayload {
  id: number | string;
  title: string;
  body?: string | null;
  type?: string | null;
  data?: Record<string, unknown> | null;
  at: string;
}

export type RealtimePayloadByEvent = {
  [RealtimeEvents.PERMISSIONS_CHANGED]: PermissionsChangedPayload;
  [RealtimeEvents.NOTIFICATION_CREATED]: NotificationCreatedPayload;
  [RealtimeEvents.NOTIFICATION_UPDATED]: Record<string, unknown>;
  [RealtimeEvents.NOTIFICATION_READ]: Record<string, unknown>;
};

export interface RealtimeSocketUser {
  sub: number;
  userType?: string;
  tenantId?: string | null;
  email?: string;
  role?: string;
  jobPositionId?: number | null;
  permissions?: string[];
}
