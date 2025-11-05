/**
 * Normalise to ASCII, lower-case, and remove diacritics.
 */
export function toAsciiLower(input: string): string {
  return input
    .normalize('NFKD') // split diacritics
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase();
}

/**
 * Subdomain-safe slug (e.g., "Acme Corporation" -> "acme-corporation").
 * - only [a-z0-9-]
 * - collapse multiple dashes
 * - trim leading/trailing dashes
 * - ensure not starting with a digit (prefix "t-")
 * - ensure non-empty (fallback to "t-tenant")
 */
export function toSubdomainSlug(name: string): string {
  let s = toAsciiLower(name)
    .replace(/[^a-z0-9]+/g, '-') // non-alnum -> dash
    .replace(/-+/g, '-') // collapse dashes
    .replace(/^-|-$/g, ''); // trim

  if (!s) s = 't-tenant';
  if (/^[0-9]/.test(s)) s = `t-${s}`;
  return s;
}

/**
 * PostgreSQL db name slug (e.g., "Acme Corporation" -> "tenant_acme_corporation")
 * - only [a-z0-9_]
 * - collapse underscores
 * - must start with a letter (prefix "t_" if not)
 * - limit to 63 chars (Postgres identifier max length)
 */
export function toDbNameSlug(name: string, prefix = 'tenant_'): string {
  let base = toAsciiLower(name)
    .replace(/[^a-z0-9]+/g, '_') // non-alnum -> underscore
    .replace(/_+/g, '_') // collapse underscores
    .replace(/^_|_$/g, ''); // trim

  if (!base) base = 'tenant';
  if (!/^[a-z]/.test(base)) base = `t_${base}`;

  let db = `${prefix}${base}`;
  if (db.length > 63) db = db.slice(0, 63); // enforce PG identifier limit
  return db;
}

/**
 * Adds a numeric suffix to avoid collisions, respecting 63-char limit.
 * E.g., "tenant_acme_corporation" -> "tenant_acme_corporation_2"
 */
export function withUniqueSuffix(base: string, suffixNum: number): string {
  const suffix = `_${suffixNum}`;
  if (base.length + suffix.length <= 63) return base + suffix;
  return base.slice(0, 63 - suffix.length) + suffix;
}
