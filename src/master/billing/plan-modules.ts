export type PlanModuleKey =
  | 'dashboard'
  | 'users'
  | 'roles'
  | 'jobpositions'
  | 'locations'
  | 'items'
  | 'vendors'
  | 'reporting-groups'
  | 'reporting-categories'
  | 'form-builder'
  | 'data-collection'
  | 'mail';

export interface PlanModuleDefinition {
  key: PlanModuleKey;
  name: string;
  description: string;
}

export const PLAN_MODULES: PlanModuleDefinition[] = [
  { key: 'dashboard', name: 'Dashboard', description: 'Tenant home dashboard' },
  { key: 'users', name: 'Users', description: 'Staff and employee accounts' },
  { key: 'roles', name: 'Roles & Permissions', description: 'Role and permission management' },
  { key: 'jobpositions', name: 'Job Positions', description: 'Job position lookup' },
  { key: 'locations', name: 'Locations', description: 'Store and kitchen locations' },
  { key: 'items', name: 'Items', description: 'Inventory catalog' },
  { key: 'vendors', name: 'Vendors', description: 'Suppliers' },
  { key: 'reporting-groups', name: 'Reporting Groups', description: 'Reporting groups' },
  { key: 'reporting-categories', name: 'Reporting Categories', description: 'Reporting categories' },
  { key: 'form-builder', name: 'Form Builder', description: 'Dynamic form builder' },
  { key: 'data-collection', name: 'Data Collection', description: 'Assignments, submissions, and templates' },
  { key: 'mail', name: 'Email Templates', description: 'Tenant email templates' },
];

export const ALL_PLAN_MODULE_KEYS: PlanModuleKey[] = PLAN_MODULES.map((module) => module.key);

export const CORE_PLAN_MODULE_KEYS: PlanModuleKey[] = [
  'dashboard',
  'users',
  'roles',
  'jobpositions',
  'locations',
];

export function isPlanModuleKey(value: string): value is PlanModuleKey {
  return ALL_PLAN_MODULE_KEYS.includes(value as PlanModuleKey);
}

export function normalizePlanModules(input?: string[] | null): PlanModuleKey[] {
  if (!input?.length) return [...ALL_PLAN_MODULE_KEYS];
  const unique = new Set<PlanModuleKey>();
  for (const value of input) {
    const key = String(value || '').trim().toLowerCase();
    if (isPlanModuleKey(key)) unique.add(key);
  }
  unique.add('dashboard');
  return ALL_PLAN_MODULE_KEYS.filter((key) => unique.has(key));
}

export function resolveModuleFromPath(path: string): PlanModuleKey | null {
  const url = String(path || '').split('?')[0].toLowerCase();
  const stripped = url.replace(/^\/api\/tenant\/[^/]+/, '/api');

  if (stripped.startsWith('/api/data-collection') || stripped.includes('/data-collection')) {
    return 'data-collection';
  }
  if (stripped.startsWith('/api/forms') || stripped.startsWith('/api/modules')) {
    return 'form-builder';
  }
  if (stripped.startsWith('/api/reporting-groups')) return 'reporting-groups';
  if (stripped.startsWith('/api/reporting-categories')) return 'reporting-categories';
  if (stripped.startsWith('/api/jobpositions')) return 'jobpositions';
  if (stripped.startsWith('/api/locations')) return 'locations';
  if (stripped.startsWith('/api/vendors')) return 'vendors';
  if (stripped.startsWith('/api/items') || stripped.startsWith('/api/products')) return 'items';
  if (stripped.startsWith('/api/users')) return 'users';
  if (stripped.startsWith('/api/roles') || stripped.startsWith('/api/permissions')) return 'roles';
  if (stripped.startsWith('/api/mail')) return 'mail';
  if (stripped.startsWith('/api/dashboard')) return 'dashboard';

  return null;
}

export function serializePlanModules(keys: string[] | null | undefined) {
  const allowed = new Set(normalizePlanModules(keys));
  return PLAN_MODULES.map((module) => ({
    ...module,
    enabled: allowed.has(module.key),
  }));
}
