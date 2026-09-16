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
  jobpositions: 'Job Position',
  locations: 'Location',
  items: 'Item',
  vendors: 'Vendor',
  'reporting-groups': 'Reporting Group',
  /** Employee task forms (assignments / submissions), not form-builder. */
  form: 'Task',
  /** DC templates only. */
  template: 'Form Template',
  /** Legacy key still used in DB for template perms. */
  'data-collection': 'Form Template',
  mail: 'Mail',
  billing: 'Billing',
  tenants: 'Tenant',
  general: 'General',
};

/**
 * Hidden from the grouped permissions API:
 * - roles (requested)
 * - form-builder (create-form etc.) — "Task" means employee assignments/submissions, not form-builder
 */
const HIDDEN_MODULE_KEYS = new Set(['roles', 'form-builder']);

/** Individual permissions omitted from the grouped permissions API response. */
const HIDDEN_PERMISSION_NAMES = new Set([
  'view-dc-submission',
  'create-form',
  'view-form',
  'edit-form',
  'delete-form',
  'publish-form',
  'submit-form',
]);

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Maps a permission name to its module key (aligned with plan module keys where possible).
 * Form Template = dc-template perms; Task = employee assignment/submission forms.
 */
export function resolvePermissionModuleName(permissionName: string): string {
  const name = String(permissionName || '')
    .trim()
    .toLowerCase();

  if (!name) return 'general';

  if (name.includes('-dc-template')) return 'template';
  if (name.includes('-dc-assignment') || name.includes('-dc-submission')) return 'form';
  if (/(^|-)dc-/.test(name)) return 'template';

  if (name.endsWith('-form') || name.includes('-form-')) return 'form-builder';
  if (name.endsWith('-reporting-group') || name.endsWith('-reporting-category')) {
    return 'reporting-groups';
  }
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
  // Prefer permission-name mapping so legacy DB module values (e.g. data-collection)
  // still split correctly into Task vs Form Template.
  if (fallbackPermissionName) {
    return resolvePermissionModuleName(fallbackPermissionName);
  }

  if (value != null) {
    const name =
      typeof value === 'string' ? value.trim() : String(value.name || '').trim();
    if (name) {
      const key = name.toLowerCase();
      if (key === 'data-collection') return 'template';
      if (key === 'form-builder') return 'form-builder';
      return key;
    }
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
    .map((part) => titleCase(part))
    .join(' ');
}

/**
 * Turns permission keys into short UI labels.
 * Assignment/submission keep distinct names so "View" is not repeated.
 */
export function formatPermissionActionName(permissionName: string): string {
  const name = String(permissionName || '')
    .trim()
    .toLowerCase();
  if (!name) return '';

  if (name.includes('-dc-assignment')) {
    if (name.startsWith('view-')) return 'View';
    if (name.startsWith('complete-')) return 'Submit';
    return titleCase(name.split('-')[0] || name);
  }

  if (name.includes('-dc-submission')) {
    if (name.startsWith('review-')) return 'Review';
    // Hidden from UI; keep a distinct label so denial is not confused with Task → View.
    if (name.startsWith('view-')) return 'View Submission';
    return titleCase(name.split('-')[0] || name);
  }

  // activate-dc-template also gates restore; show Restore in Job Position / role UIs.
  if (name === 'activate-dc-template') return 'Restore';

  const action = name.split('-')[0] || name;
  return titleCase(action);
}

function joinWithOr(items: string[]): string {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
}

/**
 * Builds a clear ForbiddenException message from missing permission keys,
 * e.g. "You do not have Create permission for User."
 */
export function formatPermissionDeniedMessage(missingPermissions: string[]): string {
  const missing = (missingPermissions || [])
    .map((permission) => String(permission || '').trim())
    .filter(Boolean);

  if (!missing.length) {
    return 'You do not have permission for this resource.';
  }

  const actionsByModule = new Map<string, string[]>();

  for (const permission of missing) {
    const moduleName = formatModuleDisplayName(resolvePermissionModuleName(permission));
    const action = formatPermissionActionName(permission) || permission;
    const actions = actionsByModule.get(moduleName) || [];
    if (!actions.includes(action)) {
      actions.push(action);
    }
    actionsByModule.set(moduleName, actions);
  }

  const parts = Array.from(actionsByModule.entries()).map(
    ([moduleName, actions]) =>
      `${joinWithOr(actions)} permission for ${moduleName}`,
  );

  return `You do not have ${joinWithOr(parts)}.`;
}

export function formatPermissionRecord<T extends { module?: string | PermissionModuleRef | null }>(
  permission: T | null,
): (Omit<T, 'module'> & { module: PermissionModuleRef | null }) | null {
  if (!permission) return null;
  return {
    ...permission,
    module: formatPermissionModule(
      resolvePermissionModuleValue(permission.module as any, (permission as any).name),
    ),
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
    // Always group from the permission name so Task vs Form Template split is correct
    // even when the DB still stores module = "data-collection".
    const moduleKey = resolvePermissionModuleName(permission.name);
    if (HIDDEN_MODULE_KEYS.has(moduleKey)) continue;
    if (HIDDEN_PERMISSION_NAMES.has(permission.name.toLowerCase())) continue;

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
