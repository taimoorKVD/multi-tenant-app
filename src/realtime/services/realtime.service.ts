import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeEvents, RealtimeEventName } from '../constants/realtime-events';
import { tenantRoom, tenantUserRoom } from '../constants/realtime-rooms';
import {
  NotificationCreatedPayload,
  PermissionsChangedPayload,
  RealtimePayloadByEvent,
} from '../types/realtime.types';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  isReady(): boolean {
    return Boolean(this.server);
  }

  emitToTenant<E extends RealtimeEventName>(
    tenantSlug: string,
    event: E,
    payload: RealtimePayloadByEvent[E] | Record<string, unknown>,
  ): void {
    if (!tenantSlug || !this.server) {
      this.logger.debug(`Skip tenant emit (${event}): server or tenant missing`);
      return;
    }
    this.server.to(tenantRoom(tenantSlug)).emit(event, payload);
  }

  emitToUser<E extends RealtimeEventName>(
    tenantSlug: string,
    userId: number,
    event: E,
    payload: RealtimePayloadByEvent[E] | Record<string, unknown>,
  ): void {
    if (!tenantSlug || !userId || !this.server) {
      this.logger.debug(`Skip user emit (${event}): server/tenant/user missing`);
      return;
    }
    this.server.to(tenantUserRoom(tenantSlug, userId)).emit(event, payload);
  }

  emitToUsers<E extends RealtimeEventName>(
    tenantSlug: string,
    userIds: number[],
    event: E,
    payload: RealtimePayloadByEvent[E] | Record<string, unknown>,
  ): void {
    const uniqueIds = [...new Set(userIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
    for (const userId of uniqueIds) {
      this.emitToUser(tenantSlug, userId, event, payload);
    }
  }

  emitPermissionsChanged(
    tenantSlug: string,
    userIds: number[],
    payload: Omit<PermissionsChangedPayload, 'action' | 'at'> &
      Partial<Pick<PermissionsChangedPayload, 'action' | 'at'>>,
  ): void {
    const fullPayload: PermissionsChangedPayload = {
      action: payload.action ?? 'resync_session',
      reason: payload.reason,
      jobPositionId: payload.jobPositionId ?? null,
      roleId: payload.roleId ?? null,
      at: payload.at ?? new Date().toISOString(),
    };
    this.emitToUsers(tenantSlug, userIds, RealtimeEvents.PERMISSIONS_CHANGED, fullPayload);
  }

  /** Ready for the future notifications module — same room topology. */
  emitNotificationCreated(
    tenantSlug: string,
    userId: number,
    payload: Omit<NotificationCreatedPayload, 'at'> & Partial<Pick<NotificationCreatedPayload, 'at'>>,
  ): void {
    this.emitToUser(tenantSlug, userId, RealtimeEvents.NOTIFICATION_CREATED, {
      ...payload,
      at: payload.at ?? new Date().toISOString(),
    });
  }
}
