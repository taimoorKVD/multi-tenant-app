import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NestMiddleware,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {TenantsService} from '../../master/tenants/tenants.service';
import {JwtService} from '@nestjs/jwt';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly BASE_DOMAIN = (process.env.BASE_DOMAIN || 'myapp.com')
      .replace(/^"|"$/g, '')
      .toLowerCase();

  constructor(
      private readonly tenantsService: TenantsService,
      private readonly jwtService: JwtService,
  ) {
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const url = req.originalUrl.toLowerCase();
      if (url.startsWith('/api/master')) {
        return next();
      }

      if (
          url.startsWith('/api/docs/*') ||
          url === '/favicon.ico'
      ) {
        return next();
      }

      const hostname = (req.headers.host?.split(':')[0] || '').toLowerCase().trim();
      if (!hostname) {
        throw new BadRequestException('Invalid hostname in request');
      }

      let tenant: string | null = null;

      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const payload = this.jwtService.verify(token);

          if (payload?.tenantId) {
            tenant = payload.tenantId.toLowerCase();
          }
        } catch {
        }
      }

      if (!tenant && hostname.endsWith(this.BASE_DOMAIN)) {
        const sub = hostname.replace(`.${this.BASE_DOMAIN}`, '');
        if (sub && sub !== 'www') {
          tenant = sub.toLowerCase();
        }
      }

      if (!tenant && !hostname.endsWith(this.BASE_DOMAIN) && hostname !== 'localhost') {
        const found = await this.tenantsService.findOneFlexible(hostname);
        if (found && (found.customDomain === hostname)) {
          tenant = found.subdomain.toLowerCase();
        }
      }

      if (!tenant) {
        const match = req.originalUrl.match(/\/tenant\/([^\/]+)/);
        if (match?.[1]) tenant = match[1].toLowerCase();
      }

      if (!tenant && req.body?.email && req.originalUrl.endsWith('/login')) {
        const domain = req.body.email.split('@')[1];
        if (domain) tenant = domain.split('.')[0].toLowerCase();
      }

      if (!tenant && req.headers['x-tenant']) {
        tenant = String(req.headers['x-tenant']).toLowerCase();
      }

      if (!tenant && req.body?.tenantId) {
        const bodyTenant = this.extractTenantCode(req.body.tenantId);
        if (bodyTenant) tenant = bodyTenant.toLowerCase();
      }

      if (!tenant && (req as any).query?.tenantId) {
        const queryTenant = this.extractTenantCode((req as any).query?.tenantId);
        if (queryTenant) tenant = queryTenant.toLowerCase();
      }

      if (!tenant) {
        throw new BadRequestException(
            'Unable to determine tenant from hostname, token, path, email, headers, or query/body tenantId.',
        );
      }

      let connection;
      try {
        connection = await this.tenantsService.getTenantConnection(tenant);
      } catch (err) {
        console.error('REAL ERROR: Failed to get connection for tenant "' + tenant + '"', err);
        if (err instanceof BadRequestException || err instanceof NotFoundException) {
          throw err;
        }
        throw new InternalServerErrorException(
            `Unable to resolve tenant "${tenant}" at this time.`,
        );
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

      console.error('❌ Unexpected tenant middleware error:', err);
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
