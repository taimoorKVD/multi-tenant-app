import {Injectable, NestMiddleware} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {MasterDataSource} from '../../database';
import {Tenant} from '../../master/tenants/entities';
import {getTenantDataSource} from '../../utils';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    async use(req: Request, res: Response, next: NextFunction) {
        try {
            const skipPaths = ['/tenants', '/auth'];
            if (skipPaths.some((p) => req.path.startsWith(p))) {
                return next();
            }

            const tenantRepo = MasterDataSource.getRepository(Tenant);
            let tenantKey = req.headers['x-tenant-id'] as string | undefined;
            let tenant: Tenant | null = null;

            if (!tenantKey && req.path.startsWith('/tenant/')) {
                const parts = req.path.split('/');
                tenantKey = parts[2];
            }

            if (tenantKey) {
                tenant = await tenantRepo.findOne({
                    where: [{name: tenantKey}, {subdomain: tenantKey}],
                });
            }

            if (!tenant && req.hostname) {
                const host = req.hostname.toLowerCase();
                const baseDomain = process.env.BASE_DOMAIN?.toLowerCase() || '';

                if (host.endsWith(baseDomain) && host !== baseDomain) {
                    const subdomain = host.replace(`.${baseDomain}`, '');
                    tenant = await tenantRepo.findOneBy({subdomain});
                } else {
                    tenant = await tenantRepo.findOneBy({customDomain: host});
                }
            }

            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    message:
                        'Tenant not found. Ensure valid path (/tenant/:tenantId), header, or domain.',
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
