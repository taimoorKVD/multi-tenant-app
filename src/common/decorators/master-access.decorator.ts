import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { MasterAuthGuard } from '../../master/auth/guards';
import { MasterPermissionsGuard } from '../guards';

export const MASTER_PERMISSIONS_KEY = 'master_permissions';

/** @example @MasterAccess('manage-tenants', 'view-users') */
export function MasterAccess(...permissions: string[]) {
  return applyDecorators(
    SetMetadata(MASTER_PERMISSIONS_KEY, permissions),
    UseGuards(MasterAuthGuard, MasterPermissionsGuard),
  );
}
