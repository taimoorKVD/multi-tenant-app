import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Observable, defer, lastValueFrom } from 'rxjs';

const ACTOR_SETTING = 'app.tenant_audit_actor_id';
const IP_SETTING = 'app.tenant_audit_ip_address';

@Injectable()
export class TenantAuditContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantAuditContextInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const tenantConnection = req?.tenantConnection as DataSource | undefined;

    if (!tenantConnection?.isInitialized) {
      return next.handle();
    }

    return defer(() => this.runWithAuditContext(req, tenantConnection, next));
  }

  private async runWithAuditContext(
    req: any,
    tenantConnection: DataSource,
    next: CallHandler,
  ): Promise<unknown> {
    const queryRunner = tenantConnection.createQueryRunner();
    await queryRunner.connect();

    try {
      await this.setDatabaseContext(
        queryRunner,
        this.resolveActorId(req),
        this.resolveIpAddress(req),
      );

      req.tenantConnection = this.createScopedConnection(tenantConnection, queryRunner);
      return await lastValueFrom(next.handle());
    } finally {
      req.tenantConnection = tenantConnection;
      await this.clearDatabaseContext(queryRunner);
      await queryRunner.release();
    }
  }

  private createScopedConnection(
    dataSource: DataSource,
    queryRunner: QueryRunner,
  ): DataSource {
    const manager = queryRunner.manager;

    return new Proxy(dataSource, {
      get(target, property, receiver) {
        if (property === 'manager') {
          return manager;
        }
        if (property === 'getRepository') {
          return manager.getRepository.bind(manager);
        }
        if (property === 'createQueryBuilder') {
          return manager.createQueryBuilder.bind(manager);
        }
        if (property === 'query') {
          return manager.query.bind(manager);
        }
        if (property === 'transaction') {
          return manager.transaction.bind(manager);
        }

        return Reflect.get(target, property, receiver);
      },
    });
  }

  private async setDatabaseContext(
    queryRunner: QueryRunner,
    actorId: number | null,
    ipAddress: string | null,
  ): Promise<void> {
    await queryRunner.query(
      `
        SELECT
          set_config('${ACTOR_SETTING}', $1, false),
          set_config('${IP_SETTING}', $2, false)
      `,
      [actorId === null ? '' : String(actorId), ipAddress ?? ''],
    );
  }

  private async clearDatabaseContext(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.isReleased) {
      return;
    }

    try {
      await queryRunner.query(
        `
          SELECT
            set_config('${ACTOR_SETTING}', '', false),
            set_config('${IP_SETTING}', '', false)
        `,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to clear tenant audit context: ${message}`);
    }
  }

  private resolveActorId(req: any): number | null {
    const candidate = req?.user?.id ?? req?.user?.sub ?? req?.user?.userId ?? null;
    if (candidate === null || candidate === undefined || candidate === '') {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isInteger(actorId) && actorId > 0 ? actorId : null;
  }

  private resolveIpAddress(req: any): string | null {
    const forwarded = req?.headers?.['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0]
        : null;
    const candidate =
      forwardedIp ||
      req?.headers?.['x-real-ip'] ||
      req?.ip ||
      req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      null;

    if (!candidate) {
      return null;
    }

    return String(candidate).trim().slice(0, 80) || null;
  }
}
