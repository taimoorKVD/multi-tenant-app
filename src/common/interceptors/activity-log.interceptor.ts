import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ActivityLogsService } from '../../master/activity-logs';

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLogInterceptor.name);

  constructor(private readonly activityLogsService: ActivityLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const endpoint: string = (req.originalUrl || req.url || '').split('?')[0];
    if (this.shouldSkip(endpoint, req.method)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const moduleName = this.resolveModule(endpoint);
    const actionName = this.resolveAction(req.method);
    const entityName = this.resolveEntity(endpoint);
    const tenantName = req.tenantId || req.headers['x-tenant'] || null;

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId = this.resolveEntityId(req.params, responseBody);
        this.persistLog({
          req,
          endpoint,
          moduleName,
          actionName,
          entityName,
          entityId,
          tenantName,
          statusCode: res.statusCode || 200,
          durationMs: Date.now() - startedAt,
          errorMessage: null,
        });
      }),
      catchError((error) => {
        const entityId = this.resolveEntityId(req.params, error?.response);
        this.persistLog({
          req,
          endpoint,
          moduleName,
          actionName,
          entityName,
          entityId,
          tenantName,
          statusCode: Number(error?.status) || 500,
          durationMs: Date.now() - startedAt,
          errorMessage: error?.message || 'Unhandled server error',
        });

        return throwError(() => error);
      }),
    );
  }

  private shouldSkip(path: string, method: string): boolean {
    if (method === 'OPTIONS') return true;

    return (
      path === '/api' ||
      path === '/api/' ||
      path.startsWith('/api/docs') ||
      path.startsWith('/api/master/activity-logs')
    );
  }

  private persistLog(params: {
    req: any;
    endpoint: string;
    moduleName: string | null;
    actionName: string;
    entityName: string | null;
    entityId: string | null;
    tenantName: string | null;
    statusCode: number;
    durationMs: number;
    errorMessage: string | null;
  }): void {
    const {
      req,
      endpoint,
      moduleName,
      actionName,
      entityName,
      entityId,
      tenantName,
      statusCode,
      durationMs,
      errorMessage,
    } = params;
    const user = req.user || {};
    const status = statusCode >= 400 ? 'failed' : 'success';

    void this.activityLogsService
      .createLog({
        tenant: tenantName ? String(tenantName) : null,
        userId: typeof user.id === 'number' ? user.id : null,
        userEmail: typeof user.email === 'string' ? user.email : null,
        action: actionName,
        module: moduleName,
        entity: entityName,
        entityId,
        method: req.method,
        endpoint,
        statusCode,
        status,
        durationMs,
        ip: req.ip || req.headers['x-forwarded-for'] || null,
        userAgent: req.headers['user-agent'] || null,
        requestId: req.headers['x-request-id'] || null,
        query: this.sanitizePayload(req.query),
        body: this.sanitizePayload(req.body),
        oldData: null,
        newData: this.shouldCaptureNewData(req.method) ? this.sanitizePayload(req.body) : null,
        errorMessage,
      })
      .catch((persistError: unknown) => {
        const message = persistError instanceof Error ? persistError.message : String(persistError);
        this.logger.error(`Failed to persist activity log: ${message}`);
      });
  }

  private sanitizePayload(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const blockedKeys = ['password', 'password_confirm', 'token', 'secret', 'authorization'];
    const source = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(source)) {
      if (blockedKeys.includes(key.toLowerCase())) {
        output[key] = '[REDACTED]';
        continue;
      }

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        output[key] = this.sanitizePayload(raw as Record<string, unknown>);
      } else {
        output[key] = raw as unknown;
      }
    }

    return output;
  }

  private resolveAction(method: string): string {
    const map: Record<string, string> = {
      GET: 'VIEW',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    return map[method?.toUpperCase()] || method?.toUpperCase() || 'UNKNOWN';
  }

  private resolveModule(endpoint: string): string | null {
    const segments = endpoint.split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== 'api') {
      return null;
    }

    if (segments[1] === 'master') {
      return 'master';
    }

    if (segments[1] === 'login' || segments[1] === 'auth') {
      return 'auth';
    }

    return 'tenant';
  }

  private resolveEntity(endpoint: string): string | null {
    const segments = endpoint.split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== 'api') {
      return null;
    }

    if (segments[1] === 'master') {
      if (endpoint.includes('/send-credentials')) {
        return 'tenant-credentials';
      }
      return segments[2] || 'master';
    }

    return segments[1] || null;
  }

  private resolveEntityId(
    params: Record<string, unknown> | undefined,
    responseBody?: unknown,
  ): string | null {
    if (!params || typeof params !== 'object') {
      return this.resolveEntityIdFromResponse(responseBody);
    }

    const possibleKeys = ['id', 'userId', 'tenantId', 'roleId'];
    for (const key of possibleKeys) {
      const value = params[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value);
      }
    }

    return this.resolveEntityIdFromResponse(responseBody);
  }

  private resolveEntityIdFromResponse(responseBody: unknown): string | null {
    if (!responseBody || typeof responseBody !== 'object') {
      return null;
    }

    const body = responseBody as Record<string, any>;
    const candidates = [
      body?.data?.id,
      body?.id,
      body?.data?.tenantId,
      body?.data?.user?.id,
      body?.user?.id,
      body?.data?.deleted?.id,
      body?.deleted?.id,
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
        return String(candidate);
      }
    }

    return null;
  }

  private shouldCaptureNewData(method: string): boolean {
    return ['POST', 'PUT', 'PATCH'].includes(method?.toUpperCase());
  }
}
