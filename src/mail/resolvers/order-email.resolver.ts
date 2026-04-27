import { Injectable } from '@nestjs/common';
import { BaseEmailResolver } from './base-email.resolver';
import { EmailResolverContext } from './email-template-resolver.interface';

@Injectable()
export class OrderEmailResolver extends BaseEmailResolver {
  readonly module = 'orders';

  override async resolve(context: EmailResolverContext): Promise<Record<string, unknown>> {
    const data = await super.resolve(context);
    const merged = { ...data, ...context.data };

    if (!merged.order_id && typeof merged.id !== 'undefined') {
      merged.order_id = merged.id;
    }

    return merged;
  }
}