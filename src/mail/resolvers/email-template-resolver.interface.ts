import { DataSource } from 'typeorm';

export interface EmailResolverContext {
  module: string;
  action: string;
  tenantId?: string | null;
  req?: any;
  tenantConnection?: DataSource | null;
  data: Record<string, unknown>;
}

export interface EmailTemplateResolver {
  readonly module: string;
  supports(module: string): boolean;
  resolve(context: EmailResolverContext): Promise<Record<string, unknown>>;
}