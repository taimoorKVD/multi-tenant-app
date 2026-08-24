import type { EmailLogoJobAttachment } from '../utils/email-logo.util';

export interface MailSmtpConfig {
  provider?: string | null;
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  password?: string | null;
  fromEmail: string;
  fromName?: string | null;
  replyTo?: string | null;
}

export interface EmailJobPayload {
  logId: number;
  tenantId: string | null;
  templateId: number;
  templateVersion: number;
  module: string;
  action: string;
  idempotencyKey: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  smtp: MailSmtpConfig;
  /** Inline logo (base64) so queued jobs keep CID embedding after Redis JSON. */
  logoAttachment?: EmailLogoJobAttachment | null;
}
