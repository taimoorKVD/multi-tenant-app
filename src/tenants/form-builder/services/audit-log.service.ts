import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FormAuditLog } from '../entities';

@Injectable()
export class AuditLogService {
  constructor(private readonly dataSource: DataSource) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  async log(
    req: any,
    payload: {
      entityType: string;
      entityId: number;
      action: string;
      oldValue?: Record<string, any> | null;
      newValue?: Record<string, any> | null;
      createdBy?: number | null;
    },
  ): Promise<void> {
    if (!req?.tenantConnection) return;

    const repo = req.tenantConnection.getRepository(FormAuditLog);
    const ipAddress =
      req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress || null;

    await repo.save(
      repo.create({
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: payload.action,
        oldValue: payload.oldValue ?? null,
        newValue: payload.newValue ?? null,
        ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
        createdBy: this.getActorId(req, payload.createdBy ?? null),
        updatedBy: this.getActorId(req, payload.createdBy ?? null),
      }),
    );
  }
}
