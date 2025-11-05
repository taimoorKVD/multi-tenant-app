import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { Tenant } from '../../master/tenants/entities';
import { getTenantDataSource } from '../../database/datasource';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly dataSource: DataSource) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const skipPaths = ['/tenants', '/auth'];
      if (skipPaths.some((p) => req.originalUrl.startsWith(p))) return next();

      const urlParts = req.originalUrl.split('/');
      const tenantIndex = urlParts.indexOf('tenant');
      if (tenantIndex === -1 || !urlParts[tenantIndex + 1]) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID missing in path (expected /tenant/:tenantId/...)',
        });
      }

      const tenantKey = urlParts[tenantIndex + 1];
      const tenantRepo = this.dataSource.getRepository(Tenant);
      const tenant = await tenantRepo.findOne({
        where: [{ name: tenantKey }, { subdomain: tenantKey }],
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: `Tenant '${tenantKey}' not found in master database.`,
        });
      }

      req['tenantConnection'] = await getTenantDataSource(tenant.dbName);
      req['tenant'] = tenant;

      return next();
    } catch (err) {
      console.error('❌ Tenant middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Tenant resolution failed.',
        error: err.message,
      });
    }
  }
}
