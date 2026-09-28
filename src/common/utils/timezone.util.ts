/** Returns true when `value` is a valid IANA timezone recognized by Intl. */
export function isValidIanaTimeZone(value: string): boolean {
  const tz = String(value || '').trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
