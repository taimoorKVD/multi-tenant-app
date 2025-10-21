import {Injectable, NestMiddleware} from '@nestjs/common';
import {NextFunction, Request, Response} from 'express';
import {MasterDataSource} from '../../database';
import {getTenantDataSource} from '../../utils';
import {Tenant} from '../../master/tenants/entities';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    async use(req: Request, res: Response, next: NextFunction) {

        const skipPaths = ['/tenants', '/auth'];
        if (skipPaths.some((p) => req.path.startsWith(p))) {
            return next();
        }

        try {
            const tenantKey = req.headers['x-tenant-id'] as string;

            if (!tenantKey) {
                return res.status(400).json({message: 'Missing x-tenant-id header'});
            }

            // Find tenant in master DB
            const tenantRepo = MasterDataSource.getRepository(Tenant);
            const tenant = await tenantRepo.findOneBy({name: tenantKey});

            if (!tenant) {
                return res.status(404).json({message: `Tenant ${tenantKey} not found`});
            }

            // Get tenant connection and attach to request
            req['tenantConnection'] = await getTenantDataSource(tenant.dbName);

            next();
        } catch (err) {
            console.error('Tenant middleware error:', err);
            res.status(500).json({message: 'Tenant resolution failed', error: err.message});
        }
    }
}
