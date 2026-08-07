import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Allows GitHub Actions / external schedulers via shared CRON_SECRET.
 * Accepts header: `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`.
 */
@Injectable()
export class CronSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.CRON_SECRET?.trim();
    if (!expected) {
      throw new UnauthorizedException('CRON_SECRET is not configured on the server');
    }

    const req = context.switchToHttp().getRequest();
    const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearerSecret = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : '';

    const provided = headerSecret || bearerSecret;
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    return true;
  }
}
