/**
 * Shared logo resolution + CID embedding for transactional emails.
 * Prefer inline CID attachments so clients that block remote images still show the brand.
 */

export const EMAIL_LOGO_CID = 'eusocial-logo';

export type EmailLogoAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

/** Serializable form for queued email jobs (Buffer does not survive JSON). */
export type EmailLogoJobAttachment = {
  filename: string;
  contentBase64: string;
  contentType: string;
  cid: string;
};

export type PreparedEmailLogo = {
  /** Use as <img src="..."> — cid: when embedded, else remote URL. */
  logoSrc: string;
  remoteUrl: string;
  attachment: EmailLogoAttachment | null;
};

export function resolveEmailLogoUrl(preferred?: string | null): string {
  const configured =
    preferred?.trim() ||
    process.env.MAIL_LOGO_URL?.trim() ||
    process.env.LOGO_URL?.trim() ||
    process.env.EMAIL_LOGO_URL?.trim();
  if (configured) return configured;

  const frontend =
    process.env.FRONTEND_URL?.trim() ||
    process.env.APP_FRONTEND_URL?.trim() ||
    'http://localhost:4200';
  return `${frontend.replace(/\/+$/, '')}/assets/eusocial-logo.png`;
}

export async function loadEmailLogoAttachment(
  logoUrl: string,
): Promise<EmailLogoAttachment | null> {
  try {
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const content = Buffer.from(await response.arrayBuffer());
    if (!content.length) return null;
    const filename = logoUrl.split('/').pop()?.split('?')[0] || 'eusocial-logo.png';
    return { filename, content, contentType };
  } catch {
    return null;
  }
}

export async function prepareEmailLogo(
  preferredUrl?: string | null,
): Promise<PreparedEmailLogo> {
  const remoteUrl = resolveEmailLogoUrl(preferredUrl);
  const attachment = await loadEmailLogoAttachment(remoteUrl);
  return {
    remoteUrl,
    attachment,
    logoSrc: attachment ? `cid:${EMAIL_LOGO_CID}` : remoteUrl,
  };
}

export function toNodemailerLogoAttachments(
  attachment: EmailLogoAttachment | null,
): Array<{
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
}> | undefined {
  if (!attachment) return undefined;
  return [
    {
      filename: attachment.filename,
      content: attachment.content,
      cid: EMAIL_LOGO_CID,
      contentType: attachment.contentType,
    },
  ];
}

export function toEmailLogoJobAttachment(
  attachment: EmailLogoAttachment | null,
): EmailLogoJobAttachment | null {
  if (!attachment) return null;
  return {
    filename: attachment.filename,
    contentBase64: attachment.content.toString('base64'),
    contentType: attachment.contentType,
    cid: EMAIL_LOGO_CID,
  };
}

export function fromEmailLogoJobAttachment(
  attachment?: EmailLogoJobAttachment | null,
): Array<{
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
}> | undefined {
  if (!attachment?.contentBase64) return undefined;
  return [
    {
      filename: attachment.filename || 'eusocial-logo.png',
      content: Buffer.from(attachment.contentBase64, 'base64'),
      cid: attachment.cid || EMAIL_LOGO_CID,
      contentType: attachment.contentType || 'image/png',
    },
  ];
}
