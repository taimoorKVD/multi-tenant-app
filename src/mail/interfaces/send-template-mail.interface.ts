export interface SendTemplateMailOptions {
  module: string;
  action: string;
  tenantId?: string | null;
  role?: string | null;
  to?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  data?: Record<string, unknown>;
  idempotencyKey?: string | null;
}

export interface SendTemplateMailResult {
  success: boolean;
  status: 'sent' | 'queued';
  logId: number;
  idempotencyKey: string;
}