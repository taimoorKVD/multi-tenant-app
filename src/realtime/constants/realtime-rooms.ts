export function tenantRoom(tenantSlug: string): string {
  return `tenant:${normalizeTenantSlug(tenantSlug)}`;
}

export function tenantUserRoom(tenantSlug: string, userId: number): string {
  return `tenant:${normalizeTenantSlug(tenantSlug)}:user:${userId}`;
}

/** Per-user notification channel (for a future notifications module). */
export function tenantUserNotificationsRoom(tenantSlug: string, userId: number): string {
  return `${tenantUserRoom(tenantSlug, userId)}:notifications`;
}

function normalizeTenantSlug(tenantSlug: string): string {
  return String(tenantSlug || '')
    .trim()
    .toLowerCase();
}
