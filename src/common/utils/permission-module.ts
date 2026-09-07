export type PermissionModuleRef = { name: string };

export type GroupedPermissionItem = {
  id: number;
  name: string;
};

export type GroupedPermissionModule = {
  module: PermissionModuleRef;
  permissions: GroupedPermissionItem[];
};

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  users: 'User',
  roles: 'Role',
  jobpositions: 'Job Position',
  locations: 'Location',
  items: 'Item',
  vendors: 'Vendor',
  'reporting-groups': 'Reporting Group',
  'reporting-categories': 'Reporting Category',
  'form-builder': 'Form Builder',
  'data-collection': 'Data Collection',
  mail: 'Mail',
  billing: 'Billing',
  tenants: 'Tenant',
  general: 'General',
};

/**
 * Maps a permission name to its module key (aligned with plan module keys where possible).
 */
export function resolvePermissionModuleName(permissionName: string): string {
  const name = String(permissionName || '')
    .trim()
    .toLowerCase();

  if (!name) return 'general';

  if (/(^|-)dc-/.test(name)) return 'data-collection';
  if (name.endsWith('-form') || name.includes('-form-')) return 'form-builder';
  if (name.endsWith('-reporting-category')) return 'reporting-categories';
  if (name.endsWith('-reporting-group')) return 'reporting-groups';
  if (name.endsWith('-job-position')) return 'jobpositions';
  if (name.endsWith('-permission')) return 'roles';
  if (name.endsWith('-role')) return 'roles';
  if (name.endsWith('-user')) return 'users';
  if (name.endsWith('-location')) return 'locations';
  if (name.endsWith('-vendor')) return 'vendors';
  if (name.endsWith('-item')) return 'items';
  if (
    name.endsWith('-plan') ||
    name.endsWith('-subscription') ||
    name.endsWith('-invoice')
  ) {
    return 'billing';
  }
  if (name.endsWith('-tenant')) return 'tenants';
  if (name.endsWith('-mail') || name.includes('email-template')) return 'mail';

  return 'general';
}

export function resolvePermissionModuleValue(
  value: PermissionModuleRef | string | null | undefined,
  fallbackPermissionName?: string,
): string | null {
  if (value != null) {
    const name =
      typeof value === 'string' ? value.trim() : String(value.name || '').trim();
    if (name) return name.toLowerCase();
  }

  if (fallbackPermissionName) {
    return resolvePermissionModuleName(fallbackPermissionName);
  }

  return null;
}

export function formatPermissionModule(
  module: string | PermissionModuleRef | null | undefined,
): PermissionModuleRef | null {
  if (module == null) return null;
  const key = typeof module === 'string' ? module : module.name;
  if (!key) return null;
  return { name: formatModuleDisplayName(key) };
}

export function formatModuleDisplayName(moduleKey: string): string {
  const key = String(moduleKey || '')
    .trim()
    .toLowerCase();
  if (!key) return 'General';
  if (MODULE_DISPLAY_NAMES[key]) return MODULE_DISPLAY_NAMES[key];
  return key
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Turns `create-user` / `archive-dc-template` into `Create` / `Archive`. */
export function formatPermissionActionName(permissionName: string): string {
  const name = String(permissionName || '')
    .trim()
    .toLowerCase();
  if (!name) return '';

  const action = name.split('-')[0] || name;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

export function formatPermissionRecord<T extends { module?: string | PermissionModuleRef | null }>(
  permission: T | null,
): (Omit<T, 'module'> & { module: PermissionModuleRef | null }) | null {
  if (!permission) return null;
  return {
    ...permission,
    module: formatPermissionModule(permission.module),
  };
}

export function formatPermissionRecords<T extends { module?: string | PermissionModuleRef | null }>(
  permissions: T[],
): Array<Omit<T, 'module'> & { module: PermissionModuleRef | null }> {
  return permissions.map(
    (permission) =>
      formatPermissionRecord(permission) as Omit<T, 'module'> & {
        module: PermissionModuleRef | null;
      },
  );
}

export function groupPermissionsByModule(
  permissions: Array<{ id: number; name: string; module?: string | PermissionModuleRef | null }>,
): GroupedPermissionModule[] {
  const groups = new Map<string, GroupedPermissionModule>();

  for (const permission of permissions) {
    const moduleKey =
      resolvePermissionModuleValue(permission.module as any, permission.name) || 'general';
    const displayName = formatModuleDisplayName(moduleKey);

    let group = groups.get(moduleKey);
    if (!group) {
      group = {
        module: { name: displayName },
        permissions: [],
      };
      groups.set(moduleKey, group);
    }

    group.permissions.push({
      id: permission.id,
      name: formatPermissionActionName(permission.name),
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    permissions: group.permissions.sort((a, b) => Number(a.id) - Number(b.id)),
  }));
}
