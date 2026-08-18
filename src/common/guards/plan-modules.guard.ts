import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { BillingService } from '../../master/billing/billing.service';
import { resolveModuleFromPath } from '../../master/billing/plan-modules';

@Injectable()
export class PlanModulesGuard implements CanActivate {
  constructor(private readonly billingService: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const path = String(request.originalUrl || request.url || '').toLowerCase();
    if (
      path.startsWith('/api/master') ||
      path.startsWith('/api/billing/stripe') ||
      path.startsWith('/api/cron') ||
      path.startsWith('/api/docs')
    ) {
      return true;
    }

    const tenantSlug = request.tenantId || request.headers?.['x-tenant-slug'] || request.headers?.['x-tenant'];
    if (!tenantSlug || !request.tenantConnection) return true;

    const requiredModule = resolveModuleFromPath(path);
    if (!requiredModule) return true;

    const entitlement =
      request.planEntitlements ||
      (await this.billingService.getTenantEntitlements(String(tenantSlug)));
    request.planEntitlements = entitlement;

    if (entitlement.allowedModules.includes(requiredModule)) {
      return true;
    }

    throw new ForbiddenException(
      `Your current plan does not include the "${requiredModule}" module. Upgrade the subscription to access it.`,
    );
  }
}
