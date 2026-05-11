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
  private readonly PUBLIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'live.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
  ]);

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
      if (req.method === 'OPTIONS') {
        return next();
      }

      const url = req.originalUrl.toLowerCase();

      // Skip routes that do not require tenant context.
      const tenantOptionalPrefixes = [
        '/api/master',
        '/api/countries',
        '/api/states',
        '/api/cities',
        '/api/collection',
        '/api/docs',
      ];

      if (
        tenantOptionalPrefixes.some((prefix) => url.startsWith(prefix)) ||
        url === '/favicon.ico' ||
        url === '/'
      ) {
        return next();
      }

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

        // ✅ GET: tenantId (fast)
        if (payload?.tenantId) {
          tenant = String(payload.tenantId).toLowerCase();
        }

        // ✅ fallback: tenantDb
        if (!tenant && payload?.tenantDb) {
          const dbName = String(payload.tenantDb).toLowerCase();
          const found = await this.tenantsService.findOneFlexible(dbName);

          if (found?.subdomain) {
            tenant = found.subdomain.toLowerCase();
          } else if (dbName.startsWith('tenant_')) {
            tenant = dbName.replace(/^tenant_/, '').replace(/_/g, '-');
          }
        }
      }

      // =========================
      // ✅ 2. HEADER (optional)
      // =========================
      if (!tenant && req.headers['x-tenant']) {
        tenant = String(req.headers['x-tenant']).toLowerCase();
      }

      if (!tenant && req.headers['x-tenant-slug']) {
        tenant = String(req.headers['x-tenant-slug']).toLowerCase();
      }

      // =========================
      // ✅ 3. URL PARAM (optional)
      // =========================
      if (!tenant) {
        const match = req.originalUrl.match(/\/tenant\/([^\/]+)\//);
        if (match?.[1]) tenant = match[1].toLowerCase();
      }

      // =========================
      // ✅ 4. BODY TENANT (login/body fallback)
      // =========================
      if (!tenant) {
        const bodyTenant = req.body?.tenant_slug || req.body?.tenantId || req.body?.tenant;
        if (bodyTenant) {
          tenant = String(bodyTenant).toLowerCase().trim();
        }
      }

      // =========================
      // ✅ 5. EMAIL HEURISTIC (AUTH PUBLIC FLOWS)
      // =========================
      const isAuthEmailRoute =
        url.endsWith('/login') ||
        url.endsWith('/forgot-password') ||
        url.endsWith('/send-email-verification') ||
        url.endsWith('/verify-email') ||
        url.endsWith('/verify-reset-token') ||
        url.endsWith('/reset-password');

      if (!tenant && isAuthEmailRoute && req.body?.email) {
        const lookupEmail = String(req.body.email).toLowerCase().trim();
        const domain = lookupEmail.split('@')[1]?.toLowerCase().trim();

        // For auth public endpoints, derive tenant from email when possible.
        const byEmail = await this.tenantsService.findOneFlexible(lookupEmail).catch(() => null);
        if (byEmail?.subdomain) {
          tenant = byEmail.subdomain.toLowerCase();
        // TEMPORARY: public-email restriction disabled during setup to allow any email.
        // Re-enable the old check when company-domain-only flow is ready:
        // else if (domain && !this.PUBLIC_EMAIL_DOMAINS.has(domain)) {
        } else if (domain) {
          const byDomain = await this.tenantsService.findOneFlexible(domain).catch(() => null);

          if (byDomain?.subdomain) {
            tenant = byDomain.subdomain.toLowerCase();
          } else {
            tenant = domain.split('.')[0].toLowerCase();
          }
        }
      }

      // =========================
      // ✅ 6. HOSTNAME (LAST RESORT ONLY)
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
        // TEMPORARY: allow email-driven public recovery/verification requests to continue without tenant context.
        // This enables testing with personal emails before company domains are onboarded.
        if (
          req.method === 'POST' &&
          (url.endsWith('/forgot-password') || url.endsWith('/send-email-verification'))
        ) {
          return next();
        }

        throw new BadRequestException(
          'Unable to identify your workspace. Please sign in using your company email on /tenant/login or contact your administrator.',
        );
      }

      // =========================
      // ✅ CONNECT DB
      // =========================
      let connection;
      try {
        connection = await this.tenantsService.getTenantConnection(tenant);
      } catch (error) {
        // TEMPORARY: during setup, allow email-driven public requests to continue even if tenant slug is unresolved.
        if (
          req.method === 'POST' &&
          (url.endsWith('/forgot-password') || url.endsWith('/send-email-verification'))
        ) {
          return next();
        }
        throw error;
      }

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