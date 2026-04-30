import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from '../../tenants/users/entities';
import { BaseEmailResolver } from './base-email.resolver';
import { EmailResolverContext } from './email-template-resolver.interface';

@Injectable()
export class UserEmailResolver extends BaseEmailResolver {
  readonly module = 'users';

  private getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  override async resolve(context: EmailResolverContext): Promise<Record<string, unknown>> {
    const resolved = await super.resolve(context);
    const data = { ...resolved, ...context.data };
    const frontendBaseUrl = this.getFrontendBaseUrl();
    const tenantSlug = String(data.tenant_slug ?? context.tenantId ?? '').trim();
    const userId = Number(data.user_id ?? data.userId ?? 0);

    if (context.tenantConnection && userId > 0) {
      const userRepo: Repository<User> = context.tenantConnection.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        relations: ['role', 'jobPosition', 'location'],
      });

      if (user) {
        Object.assign(data, {
          user_id: user.id,
          first_name: data.first_name ?? user.name.split(' ')[0],
          full_name: data.full_name ?? user.name,
          email: data.email ?? user.email,
          username: data.username ?? user.username,
          role_name: data.role_name ?? user.role?.name ?? null,
          location_name: data.location_name ?? user.location?.name ?? null,
          job_position_name: data.job_position_name ?? user.jobPosition?.name ?? null,
        });
      }
    }

    if (!data.first_name && typeof data.name === 'string') {
      data.first_name = data.name.split(' ')[0];
    }

    if (!data.full_name && typeof data.name === 'string') {
      data.full_name = data.name;
    }

    if (!data.tenant_slug) {
      data.tenant_slug = tenantSlug || null;
    }

    if (!data.logo_url) {
      data.logo_url = `${frontendBaseUrl}/assets/eusocial-logo.png`;
    }

    if (!data.tenant_login_url) {
      data.tenant_login_url = tenantSlug
        ? `${frontendBaseUrl}/tenant/${tenantSlug}/login`
        : `${frontendBaseUrl}/tenant/login`;
    }

    return data;
  }
}