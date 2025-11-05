import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MASTER_PERMISSIONS_KEY } from '../decorators';

@Injectable()
export class MasterPermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perms =
      this.reflector.getAllAndOverride<string[]>(MASTER_PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) || [];

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('User not authenticated (master)');
    if (!perms.length) return true;

    const userPerms =
      user.role?.permissions?.map((p) => (typeof p === 'string' ? p : p.name)) || [];

    const missing = perms.filter((p) => !userPerms.includes(p));
    if (missing.length)
      throw new ForbiddenException(
        `You do not have permission for this resource: ${missing.join(', ')}`,
      );

    return true;
  }
}
