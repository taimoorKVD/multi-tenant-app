import {CanActivate, ExecutionContext, ForbiddenException, Injectable,} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {PERMISSIONS_KEY} from '../decorators';

@Injectable()
export class TenantPermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {
    }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );
        if (!requiredPermissions?.length) return true;

        const request = context.switchToHttp().getRequest();
        if (!request.tenantConnection) {
            return true;
        }

        const user = request.user;
        if (!user) {
            throw new ForbiddenException('User not authenticated for this tenant');
        }

        const userPerms = user.role?.permissions?.map((p) => p.name) || [];

        const hasPermission = requiredPermissions.every((perm) =>
            userPerms.includes(perm),
        );
        if (!hasPermission) {
            throw new ForbiddenException(
                `You do not have permission to access this tenant resource`,
            );
        }

        return true;
    }
}
