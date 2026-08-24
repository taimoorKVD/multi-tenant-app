/**
 * Shared logo resolution + CID embedding for transactional emails.
 * Prefer a bundled file so sending never depends on the frontend URL being fetchable.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const EMAIL_LOGO_CID = 'eusocial-logo';
export const EMAIL_LOGO_FILENAME = 'eusocial-logo.png';
export const EMAIL_LOGO_PUBLIC_PATH = `/images/${EMAIL_LOGO_FILENAME}`;

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

type NodemailerLogoAttachment = {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
  contentDisposition: 'inline';
};

function localLogoCandidates(): string[] {
  const envPath = process.env.MAIL_LOGO_PATH?.trim();
  return [
    envPath,
    join(__dirname, '..', 'assets', EMAIL_LOGO_FILENAME),
    join(process.cwd(), 'src', 'mail', 'assets', EMAIL_LOGO_FILENAME),
    join(process.cwd(), 'dist', 'mail', 'assets', EMAIL_LOGO_FILENAME),
    join(process.cwd(), 'dist', 'src', 'mail', 'assets', EMAIL_LOGO_FILENAME),
  ].filter((value): value is string => Boolean(value));
}

export function loadLocalEmailLogoAttachment(): EmailLogoAttachment | null {
  for (const filePath of localLogoCandidates()) {
    try {
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath);
      if (!content.length) continue;
      return {
        filename: EMAIL_LOGO_FILENAME,
        content,
        contentType: 'image/png',
      };
    } catch {
      continue;
    }
  }
  return null;
}

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
  return `${frontend.replace(/\/+$/, '')}${EMAIL_LOGO_PUBLIC_PATH}`;
}

function mimeType(contentType: string): string {
  return contentType.split(';')[0].trim().toLowerCase();
}

function looksLikeImage(content: Buffer): boolean {
  if (content.length < 12) return false;
  if (content[0] === 0x89 && content[1] === 0x50 && content[2] === 0x4e && content[3] === 0x47) {
    return true;
  }
  if (content[0] === 0xff && content[1] === 0xd8) return true;
  if (content[0] === 0x47 && content[1] === 0x49 && content[2] === 0x46) return true;
  return (
    content.subarray(0, 4).toString('ascii') === 'RIFF' &&
    content.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export async function loadEmailLogoAttachment(
  logoUrl: string,
): Promise<EmailLogoAttachment | null> {
  try {
    const response = await fetch(logoUrl, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    const mime = mimeType(contentType);
    const content = Buffer.from(await response.arrayBuffer());
    if (!content.length) return null;
    if (!mime.startsWith('image/') && mime !== 'application/octet-stream') return null;
    if (mime === 'application/octet-stream' && !looksLikeImage(content)) return null;
    const filename = logoUrl.split('/').pop()?.split('?')[0] || EMAIL_LOGO_FILENAME;
    return {
      filename,
      content,
      contentType: mime.startsWith('image/') ? mime : 'image/png',
    };
  } catch {
    return null;
  }
}

export async function prepareEmailLogo(
  preferredUrl?: string | null,
): Promise<PreparedEmailLogo> {
  const remoteUrl = resolveEmailLogoUrl(preferredUrl);
  const attachment =
    loadLocalEmailLogoAttachment() || (await loadEmailLogoAttachment(remoteUrl));
  return {
    remoteUrl,
    attachment,
    logoSrc: attachment ? `cid:${EMAIL_LOGO_CID}` : remoteUrl,
  };
}

export function toNodemailerLogoAttachments(
  attachment: EmailLogoAttachment | null,
): NodemailerLogoAttachment[] | undefined {
  if (!attachment) return undefined;
  return [
    {
      filename: attachment.filename,
      content: attachment.content,
      cid: EMAIL_LOGO_CID,
      contentType: attachment.contentType,
      contentDisposition: 'inline',
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
): NodemailerLogoAttachment[] | undefined {
  if (!attachment?.contentBase64) return undefined;
  return [
    {
      filename: attachment.filename || EMAIL_LOGO_FILENAME,
      content: Buffer.from(attachment.contentBase64, 'base64'),
      cid: attachment.cid || EMAIL_LOGO_CID,
      contentType: attachment.contentType || 'image/png',
      contentDisposition: 'inline',
    },
  ];
}
