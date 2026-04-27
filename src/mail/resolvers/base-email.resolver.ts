import { Injectable } from '@nestjs/common';
import { EmailResolverContext, EmailTemplateResolver } from './email-template-resolver.interface';

@Injectable()
export class BaseEmailResolver implements EmailTemplateResolver {
  readonly module: string = 'default';

  supports(module: string): boolean {
    return module === this.module;
  }

  async resolve(context: EmailResolverContext): Promise<Record<string, unknown>> {
    return {
      ...context.data,
      tenant_id: context.tenantId ?? null,
      current_date: new Date().toISOString(),
    };
  }
}