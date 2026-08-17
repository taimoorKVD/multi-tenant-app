import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { TenantAuthGuard } from 'src/tenants/auth/guards/tenant-auth.guard';
import { TenantPermissionsGuard } from '../guards';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Unified decorator to handle tenant authentication and permission checks.
 * Plan module access is enforced globally by PlanModulesGuard.
 * @example @TenantAccess('view-user', 'edit-user')
 */
export function TenantAccess(...permissions: string[]) {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(TenantAuthGuard, TenantPermissionsGuard),
  );
}
