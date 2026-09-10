import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../common/decorators';
import { formatPermissionDeniedMessage } from '../../../common/utils/permission-module';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (!requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User not authenticated for tenant context');
    }

    const permissions =
      user.permissions ||
      user.role?.permissions?.map((permission) =>
        typeof permission === 'string' ? permission : permission.name,
      ) ||
      [];

    const missing = requiredPermissions.filter((permission) => !permissions.includes(permission));
    if (missing.length) {
      throw new ForbiddenException(formatPermissionDeniedMessage(missing));
    }

    return true;
  }
}
