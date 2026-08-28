import { Injectable } from '@nestjs/common';
import { EmailResolverContext, EmailTemplateResolver } from './email-template-resolver.interface';

@Injectable()
export class BaseEmailResolver implements EmailTemplateResolver {
  readonly module: string = 'default';

  supports(module: string): boolean {
    return module === this.module;
  }

  protected getFrontendBaseUrl(): string {
    const frontendUrl = process.env.FRONTEND_URL?.trim() || process.env.APP_FRONTEND_URL?.trim();
    if (frontendUrl) {
      return frontendUrl.replace(/\/+$/, '');
    }

    return 'http://localhost:4200';
  }

  protected getPlatformHost(): string {
    const explicit = process.env.PLATFORM_DOMAIN?.trim();
    if (explicit) return explicit.replace(/^\./, '').replace(/\/+$/, '');

    try {
      return new URL(this.getFrontendBaseUrl()).hostname.replace(/^(www|admin)\./, '');
    } catch {
      return 'eusocial.thebetawebsite.com';
    }
  }

  protected getTenantAppUrl(subdomain: string, customDomain?: string | null): string {
    if (customDomain?.trim()) {
      const host = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }

    let protocol = 'https';
    let port = '';
    try {
      const frontend = new URL(this.getFrontendBaseUrl());
      protocol = frontend.protocol.replace(':', '') || 'https';
      port = frontend.port ? `:${frontend.port}` : '';
    } catch {
      protocol = 'https';
    }

    return `${protocol}://${subdomain}.${this.getPlatformHost()}${port}`;
  }

  /** Tenant workspace URL, e.g. https://folio3.eusocial.thebetawebsite.com/ */
  protected getTenantLoginUrl(tenantSlug?: string | null, customDomain?: string | null): string {
    const slug = String(tenantSlug || '').trim().toLowerCase();
    if (slug && !/^\d+$/.test(slug)) {
      return `${this.getTenantAppUrl(slug, customDomain)}/`;
    }
    return `${this.getFrontendBaseUrl()}/`;
  }

  async resolve(context: EmailResolverContext): Promise<Record<string, unknown>> {
    const data = { ...context.data };
    const tenantSlug = String(
      data.tenant_slug ?? context.tenantId ?? context.req?.tenantId ?? '',
    ).trim();
    const customDomain =
      (data.custom_domain as string | null | undefined) ??
      (data.customDomain as string | null | undefined) ??
      context.req?.tenant?.customDomain ??
      context.req?.customDomain ??
      null;

    if (!data.tenant_slug && tenantSlug) {
      data.tenant_slug = tenantSlug;
    }

    const resolvedLoginUrl = this.getTenantLoginUrl(tenantSlug, customDomain);
    const existingLoginUrl = String(data.tenant_login_url || '');
    if (
      !existingLoginUrl ||
      existingLoginUrl.includes('/tenant/login') ||
      (tenantSlug && !/^\d+$/.test(tenantSlug) && !existingLoginUrl.includes(`${tenantSlug}.`))
    ) {
      data.tenant_login_url = resolvedLoginUrl;
    }

    return {
      ...data,
      tenant_id: context.tenantId ?? null,
      current_date: new Date().toISOString(),
    };
  }
}
