export const EMAIL_QUEUE_NAME = 'email-dispatch';
export const EMAIL_JOB_NAME = 'send-template-email';

export const EMAIL_TEMPLATE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const EMAIL_LOG_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const EMAIL_RECIPIENT_CHANNEL = {
  TO: 'to',
  CC: 'cc',
  BCC: 'bcc',
} as const;

export const EMAIL_RECIPIENT_SOURCE = {
  STATIC: 'static',
  PLACEHOLDER: 'placeholder',
  USER: 'user',
  ROLE: 'role',
} as const;

export type EmailTemplateStatus =
  (typeof EMAIL_TEMPLATE_STATUS)[keyof typeof EMAIL_TEMPLATE_STATUS];

export type EmailLogStatus = (typeof EMAIL_LOG_STATUS)[keyof typeof EMAIL_LOG_STATUS];

export type EmailRecipientChannel =
  (typeof EMAIL_RECIPIENT_CHANNEL)[keyof typeof EMAIL_RECIPIENT_CHANNEL];

export type EmailRecipientSource =
  (typeof EMAIL_RECIPIENT_SOURCE)[keyof typeof EMAIL_RECIPIENT_SOURCE];