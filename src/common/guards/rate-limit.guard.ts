import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Type,
  mixin,
} from '@nestjs/common';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export function createRateLimitGuard(limit = 5, windowMs = 15 * 60 * 1000): Type<CanActivate> {
  @Injectable()
  class RateLimitGuardMixin implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const ip =
        request.ip ||
        request.headers['x-forwarded-for'] ||
        request.socket?.remoteAddress ||
        'unknown';
      const route = request.route?.path || request.originalUrl || 'unknown';
      const email = String(request.body?.email || '').trim().toLowerCase();
      const key = `${route}:${ip}:${email}`;
      const now = Date.now();
      const current = store.get(key);

      if (!current || current.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (current.count >= limit) {
        throw new HttpException('Too many attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
      }

      current.count += 1;
      store.set(key, current);
      return true;
    }
  }

  return mixin(RateLimitGuardMixin);
}