import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NestMiddleware,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantsService } from '../../master/tenants/tenants.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly BASE_DOMAIN = 'eusocial.com';

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
  ) {}

  // async use(req: Request, res: Response, next: NextFunction) {
  //   try {
  //     const url = req.originalUrl.toLowerCase();
  //     if (url.startsWith('/api/master')) {
  //       return next();
  //     }

  //     if (url.startsWith('/api/docs/*') || url === '/favicon.ico') {
  //       return next();
  //     }

  //     const hostname = (req.headers.host?.split(':')[0] || '').toLowerCase().trim();
  //     if (!hostname) {
  //       throw new BadRequestException('Invalid hostname in request');
  //     }

  //     let tenant: string | null = null;

  //     const authHeader = req.headers['authorization'];
  //     if (authHeader?.startsWith('Bearer ')) {
  //       try {
  //         const token = authHeader.split(' ')[1];
  //         const payload = this.jwtService.verify(token);

  //         if (payload?.tenantId) {
  //           tenant = payload.tenantId.toLowerCase();
  //         }
  //       } catch {}
  //     }

  //     if (!tenant && hostname.endsWith(this.BASE_DOMAIN)) {
  //       const sub = hostname.replace(`.${this.BASE_DOMAIN}`, '');
  //       if (sub && sub !== 'www') {
  //         tenant = sub.toLowerCase();
  //       }
  //     }

  //     if (!tenant && !hostname.endsWith(this.BASE_DOMAIN) && hostname !== 'localhost') {
  //       const found = await this.tenantsService.findOneFlexible(hostname);
  //       if (found && found.customDomain === hostname) {
  //         tenant = found.subdomain.toLowerCase();
  //       }
  //     }

  //     if (!tenant) {
  //       const match = req.originalUrl.match(/\/tenant\/([^\/]+)/);
  //       if (match?.[1]) tenant = match[1].toLowerCase();
  //     }

  //     if (!tenant && req.body?.email && req.originalUrl.endsWith('/login')) {
  //       const domain = req.body.email.split('@')[1];
  //       if (domain) tenant = domain.split('.')[0].toLowerCase();
  //     }

  //     if (!tenant && req.headers['x-tenant']) {
  //       tenant = String(req.headers['x-tenant']).toLowerCase();
  //     }

  //     if (!tenant) {
  //       throw new BadRequestException(
  //         'Unable to determine tenant from hostname, token, path, email, or headers.',
  //       );
  //     }

  //     let connection;
  //     try {
  //       connection = await this.tenantsService.getTenantConnection(tenant);
  //     } catch {
  //       throw new NotFoundException(`Tenant "${tenant}" not found or inactive.`);
  //     }

  //     req['tenantId'] = tenant;
  //     req['tenantConnection'] = connection;

  //     return next();
  //   } catch (err) {
  //     if (
  //       err instanceof BadRequestException ||
  //       err instanceof UnauthorizedException ||
  //       err instanceof NotFoundException
  //     ) {
  //       throw err;
  //     }

  //     console.error('❌ Unexpected tenant middleware error:', err);
  //     throw new InternalServerErrorException('Tenant resolution failed.');
  //   }
  // }
  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const url = req.originalUrl.toLowerCase();

      // ✅ Skip master routes
      if (url.startsWith('/api/master')) return next();

      // ✅ Skip docs/static
      if (url.startsWith('/api/docs') || url === '/favicon.ico') return next();

      let tenant: string | null = null;

      // =========================
      // ✅ 1. JWT (PRIMARY SOURCE)
      // =========================
      const authHeader = req.headers['authorization'];

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        let payload: any = null;

        const secrets = [
          process.env.JWT_SECRET,
          process.env.TENANT_JWT_SECRET,
          process.env.MASTER_JWT_SECRET,
        ].filter(Boolean) as string[];

        for (const secret of secrets) {
          try {
            payload = this.jwtService.verify(token, { secret });
            if (payload) break;
          } catch {}
        }

        if (!payload) {
          payload = this.jwtService.decode(token);
        }

        // ✅ BEST: tenantId (fast)
        if (payload?.tenantId) {
          tenant = String(payload.tenantId).toLowerCase();
        }

        // ✅ fallback: tenantDb
        if (!tenant && payload?.tenantDb) {
          const dbName = String(payload.tenantDb).toLowerCase();

          if (dbName.startsWith('tenant_')) {
            tenant = dbName.replace(/^tenant_/, '');
          } else {
            const found = await this.tenantsService.findOneFlexible(dbName);
            if (found?.subdomain) {
              tenant = found.subdomain.toLowerCase();
            }
          }
        }
      }

      // =========================
      // ✅ 2. HEADER (optional)
      // =========================
      if (!tenant && req.headers['x-tenant']) {
        tenant = String(req.headers['x-tenant']).toLowerCase();
      }

      // =========================
      // ✅ 3. URL PARAM (optional)
      // =========================
      if (!tenant) {
        const match = req.originalUrl.match(/\/tenant\/([^\/]+)/);
        if (match?.[1]) tenant = match[1].toLowerCase();
      }

      // =========================
      // ✅ 4. LOGIN EMAIL (IMPORTANT)
      // =========================
      if (!tenant && url.endsWith('/login') && req.body?.email) {
        const domain = req.body.email.split('@')[1];
        if (domain) tenant = domain.split('.')[0].toLowerCase();
      }

      // =========================
      // ✅ 5. HOSTNAME (LAST RESORT ONLY)
      // =========================
      const hostname = (req.headers.host?.split(':')[0] || '').toLowerCase();

      if (
        !tenant &&
        hostname &&
        hostname !== 'localhost' &&
        hostname.endsWith(this.BASE_DOMAIN)
      ) {
        const sub = hostname.replace(`.${this.BASE_DOMAIN}`, '');
        if (sub && sub !== 'www') {
          tenant = sub.toLowerCase();
        }
      }

      // =========================
      // ❌ FINAL CHECK
      // =========================
      if (!tenant) {
        throw new BadRequestException(
          'Tenant not resolved. Provide valid token or tenant context.',
        );
      }

      // =========================
      // ✅ CONNECT DB
      // =========================
      const connection = await this.tenantsService.getTenantConnection(tenant);

      req['tenantId'] = tenant;
      req['tenantConnection'] = connection;

      return next();

    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof NotFoundException
      ) {
        throw err;
      }

      console.error('❌ Tenant middleware error:', err);
      throw new InternalServerErrorException('Tenant resolution failed.');
    }
  }

  protected isSubdomainHost(hostname: string): boolean {
    return hostname.endsWith(this.BASE_DOMAIN) && hostname.split('.').length > 2;
  }

  protected extractTenantCode(input: any): string | null {
    if (!input) return null;
    if (typeof input === 'string') return input;
    if (input?.data?.code) return input.data.code;
    if (input?.code) return input.code;
    return null;
  }
}