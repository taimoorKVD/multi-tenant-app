import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionsChangedReason, RealtimeService } from '../../realtime';
import { TenantAuthService } from './auth.service';

@Injectable()
export class PermissionSessionSyncService {
  private readonly logger = new Logger(PermissionSessionSyncService.name);

  constructor(
    private readonly authService: TenantAuthService,
    private readonly realtimeService: RealtimeService,
  ) {}

  /**
   * Hybrid permission sync:
   * 1) Revoke refresh tokens so stale sessions cannot rotate forever
   * 2) Push WS `permissions.changed` so online clients call `/resync-session`
   */
  async syncUsers(
    req: { tenantId?: string | null; tenantConnection?: DataSource },
    userIds: number[],
    meta: {
      reason: PermissionsChangedReason;
      jobPositionId?: number | null;
      roleId?: number | null;
    },
  ): Promise<void> {
    const uniqueIds = [
      ...new Set(userIds.map(Number).filter((id) => Number.isFinite(id) && id > 0)),
    ];
    if (!uniqueIds.length) {
      return;
    }

    const tenantConnection = req.tenantConnection;
    if (tenantConnection) {
      await this.authService.revokeRefreshTokensForUsers(tenantConnection, uniqueIds);
    } else {
      this.logger.warn('Permission sync skipped refresh revoke: missing tenant connection');
    }

    const tenantSlug = String(req.tenantId || '').trim();
    if (!tenantSlug) {
      this.logger.warn('Permission sync skipped WS emit: missing tenant slug');
      return;
    }

    this.realtimeService.emitPermissionsChanged(tenantSlug, uniqueIds, {
      reason: meta.reason,
      jobPositionId: meta.jobPositionId ?? null,
      roleId: meta.roleId ?? null,
    });
  }
}
