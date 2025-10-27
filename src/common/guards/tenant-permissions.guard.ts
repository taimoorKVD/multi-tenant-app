import {CanActivate, ExecutionContext, ForbiddenException, Injectable,} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {PERMISSIONS_KEY} from '../decorators';

@Injectable()
export class TenantPermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {
    }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions =
            this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
                context.getHandler(),
                context.getClass(),
            ]) || [];

        const request = context.switchToHttp().getRequest();
        const {user, tenantConnection} = request;

        if (!tenantConnection) return true;
        if (!user) throw new ForbiddenException('User not authenticated for this tenant');
        if (!requiredPermissions.length) return true;

        const userPermissions =
            user.permissions ||
            user.role?.permissions?.map((p) => (typeof p === 'string' ? p : p.name)) ||
            [];
        const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));
        if (missing.length) {
            throw new ForbiddenException(
                `You do not have permission for this resource: ${missing.join(', ')}`,
            );
        }

        return true;
    }
}
