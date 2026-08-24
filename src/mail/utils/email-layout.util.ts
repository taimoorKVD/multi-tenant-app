/**
 * Shared EuSocial transactional email layout.
 * Table-based + inline styles for broad client compatibility.
 */

export const EMAIL_COLORS = {
  canvas: '#eef2f7',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  header: '#0f1c2e',
  accent: '#f59e0b',
  accentHover: '#d97706',
  title: '#0f172a',
  body: '#475569',
  muted: '#64748b',
  subtle: '#94a3b8',
  label: '#64748b',
  value: '#0f172a',
  panelBg: '#f8fafc',
  panelBorder: '#e2e8f0',
  link: '#0369a1',
  warningBg: '#fffbeb',
  warningBorder: '#f59e0b',
  warningText: '#92400e',
  infoBg: '#eff6ff',
  infoBorder: '#3b82f6',
  infoText: '#1e40af',
  successBg: '#ecfdf5',
  successBorder: '#10b981',
  successText: '#065f46',
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace";

export type EmailDetailRow = {
  label: string;
  value: string;
  monospace?: boolean;
  /** When true, value is inserted as raw HTML (already escaped/safe). */
  html?: boolean;
};

export type EmailNotice = {
  title: string;
  text: string;
  variant?: 'warning' | 'info' | 'success';
};

export type EmailCta = {
  label: string;
  url: string;
};

export type EmailBadge = {
  label: string;
  bg: string;
  color: string;
};

export type RenderEmailLayoutOptions = {
  logoUrl?: string | null;
  brandTitle?: string;
  title: string;
  preheader?: string;
  introHtml?: string;
  bodyHtml?: string;
  rows?: EmailDetailRow[];
  /** Prebuilt row HTML (e.g. seeders with {placeholders}). */
  rowsHtml?: string;
  /** Use stacked single-column rows instead of label|value. */
  stackedRows?: boolean;
  cta?: EmailCta | null;
  notice?: EmailNotice | null;
  badge?: EmailBadge | null;
  accent?: string;
  footerNote?: string;
};

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function emailEscape(value: string): string {
  return escapeHtml(value);
}

export function renderEmailDetailRows(
  rows: EmailDetailRow[],
  options?: { stacked?: boolean },
): string {
  if (!rows.length) return '';

  if (options?.stacked) {
    return rows
      .map((row, index) => {
        const isLast = index === rows.length - 1;
        const valueStyle = row.monospace
          ? `font-family:${MONO};font-size:13px;color:${EMAIL_COLORS.value};word-break:break-all;`
          : `font-size:14px;line-height:22px;color:${EMAIL_COLORS.value};word-break:break-word;`;
        const value = row.html ? row.value : escapeHtml(row.value);
        return `
          <tr>
            <td style="padding:${index === 0 ? '16px' : '0'} 18px ${isLast ? '16px' : '12px'};">
              <div style="font-size:11px;line-height:16px;letter-spacing:0.04em;text-transform:uppercase;color:${EMAIL_COLORS.label};font-weight:600;margin:0 0 4px;">${escapeHtml(row.label)}</div>
              <div style="${valueStyle}">${value}</div>
            </td>
          </tr>`;
      })
      .join('');
  }

  return rows
    .map((row, index) => {
      const isLast = index === rows.length - 1;
      const border = isLast ? '' : `border-bottom:1px solid ${EMAIL_COLORS.panelBorder};`;
      const valueStyle = row.monospace
        ? `padding:14px 16px;font-size:13px;line-height:20px;color:${EMAIL_COLORS.value};font-family:${MONO};background:${EMAIL_COLORS.card};word-break:break-all;`
        : `padding:14px 16px;font-size:14px;line-height:22px;color:${EMAIL_COLORS.value};background:${EMAIL_COLORS.card};word-break:break-word;`;
      const value = row.html ? row.value : escapeHtml(row.value);
      return `
        <tr>
          <td style="padding:14px 16px;font-size:12px;line-height:18px;letter-spacing:0.02em;text-transform:uppercase;color:${EMAIL_COLORS.label};background:${EMAIL_COLORS.panelBg};width:38%;vertical-align:top;${border}"><strong style="font-weight:600;">${escapeHtml(row.label)}</strong></td>
          <td style="${valueStyle}${border}">${value}</td>
        </tr>`;
    })
    .join('');
}

/** Simple stacked rows for DB templates that embed {placeholders} in values. */
export function renderEmailPlaceholderRows(
  rows: Array<{ label: string; value: string }>,
): string {
  return rows
    .map((row, index) => {
      const isFirst = index === 0;
      const isLast = index === rows.length - 1;
      return `
        <tr>
          <td style="padding:${isFirst ? '16px' : '0'} 18px ${isLast ? '16px' : '12px'};">
            <div style="font-size:11px;line-height:16px;letter-spacing:0.04em;text-transform:uppercase;color:${EMAIL_COLORS.label};font-weight:600;margin:0 0 4px;">${escapeHtml(row.label)}</div>
            <div style="font-size:14px;line-height:22px;color:${EMAIL_COLORS.value};word-break:break-word;">${row.value}</div>
          </td>
        </tr>`;
    })
    .join('');
}

function renderNotice(notice: EmailNotice): string {
  const variant = notice.variant || 'warning';
  const map = {
    warning: {
      bg: EMAIL_COLORS.warningBg,
      border: EMAIL_COLORS.warningBorder,
      text: EMAIL_COLORS.warningText,
    },
    info: {
      bg: EMAIL_COLORS.infoBg,
      border: EMAIL_COLORS.infoBorder,
      text: EMAIL_COLORS.infoText,
    },
    success: {
      bg: EMAIL_COLORS.successBg,
      border: EMAIL_COLORS.successBorder,
      text: EMAIL_COLORS.successText,
    },
  }[variant];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;">
      <tr>
        <td style="background:${map.bg};border:1px solid ${map.border};border-left:4px solid ${map.border};border-radius:10px;padding:14px 16px;">
          <p style="margin:0 0 4px;font-size:13px;line-height:18px;font-weight:700;color:${map.text};">${escapeHtml(notice.title)}</p>
          <p style="margin:0;font-size:13px;line-height:20px;color:${map.text};">${escapeHtml(notice.text)}</p>
        </td>
      </tr>
    </table>`;
}

function renderCta(cta: EmailCta): string {
  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:4px 0 24px;">
      <tr>
        <td align="left" style="border-radius:10px;background:${EMAIL_COLORS.accent};">
          <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:${EMAIL_COLORS.accent};color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:700;letter-spacing:0.01em;">${escapeHtml(cta.label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderEmailLayout(options: RenderEmailLayoutOptions): string {
  const year = new Date().getFullYear();
  const brandTitle = options.brandTitle || 'EuSocial';
  const accent = options.accent || EMAIL_COLORS.accent;
  const preheader = options.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(options.preheader)}</div>`
    : '';

  const headerBrand = options.logoUrl
    ? `<img src="${escapeHtml(options.logoUrl)}" alt="${escapeHtml(brandTitle)}" width="160" height="50" style="height:42px;width:auto;max-width:180px;display:block;border:0;outline:none;text-decoration:none;" />`
    : `<div style="font-size:18px;line-height:24px;font-weight:700;letter-spacing:0.2px;color:#ffffff;">${escapeHtml(brandTitle)}</div>`;

  const badgeHtml = options.badge
    ? `<span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${escapeHtml(options.badge.bg)};color:${escapeHtml(options.badge.color)};font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;margin:0 0 14px;">${escapeHtml(options.badge.label)}</span>`
    : '';

  const rowsContent =
    options.rowsHtml ||
    (options.rows?.length
      ? renderEmailDetailRows(options.rows, { stacked: options.stackedRows })
      : '');

  const detailsHtml = rowsContent
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:1px solid ${EMAIL_COLORS.panelBorder};border-radius:12px;background:${EMAIL_COLORS.panelBg};overflow:hidden;">
        ${rowsContent}
      </table>`
    : '';

  const introHtml = options.introHtml
    ? `<div style="margin:0 0 18px;font-size:15px;line-height:24px;color:${EMAIL_COLORS.body};">${options.introHtml}</div>`
    : '';

  const bodyHtml = options.bodyHtml || '';
  const noticeHtml = options.notice ? renderNotice(options.notice) : '';
  const ctaHtml = options.cta ? renderCta(options.cta) : '';
  const footerNote =
    options.footerNote ||
    `© ${year} EuSocial. All rights reserved.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.canvas};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLORS.canvas};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${EMAIL_COLORS.card};border-radius:16px;overflow:hidden;border:1px solid ${EMAIL_COLORS.cardBorder};box-shadow:0 8px 24px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:22px 28px;background:${EMAIL_COLORS.header};">
              ${headerBrand}
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 28px 12px;font-family:${FONT};color:${EMAIL_COLORS.title};">
              ${badgeHtml}
              <h1 style="margin:0 0 14px;font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${EMAIL_COLORS.title};">${escapeHtml(options.title)}</h1>
              ${introHtml}
              ${bodyHtml}
              ${detailsHtml}
              ${noticeHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;font-family:${FONT};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${EMAIL_COLORS.panelBorder};">
                <tr>
                  <td style="padding-top:18px;font-size:12px;line-height:18px;color:${EMAIL_COLORS.subtle};">
                    ${escapeHtml(footerNote)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
