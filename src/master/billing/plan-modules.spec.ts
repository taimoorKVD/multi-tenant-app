import {
  ALL_PLAN_MODULE_KEYS,
  normalizePlanModules,
  resolveModuleFromPath,
  serializePlanModules,
} from './plan-modules';

describe('plan-modules', () => {
  it('treats an empty list as all modules and always keeps dashboard', () => {
    expect(normalizePlanModules([])).toEqual(ALL_PLAN_MODULE_KEYS);
    expect(normalizePlanModules(['items'])).toEqual(['dashboard', 'items']);
  });

  it('ignores unknown keys', () => {
    expect(normalizePlanModules(['users', 'not-a-module'])).toEqual(['dashboard', 'users']);
  });

  it('maps tenant API paths to module keys', () => {
    expect(resolveModuleFromPath('/api/data-collection/assignments/my-work')).toBe('data-collection');
    expect(resolveModuleFromPath('/api/tenant/acme/items?page=1')).toBe('items');
    expect(resolveModuleFromPath('/api/modules')).toBe('form-builder');
    expect(resolveModuleFromPath('/api/forms/12')).toBe('form-builder');
    expect(resolveModuleFromPath('/api/login')).toBeNull();
  });

  it('serializes enabled flags for the Angular sidebar', () => {
    const modules = serializePlanModules(['dashboard', 'users']);
    expect(modules.find((module) => module.key === 'users')?.enabled).toBe(true);
    expect(modules.find((module) => module.key === 'data-collection')?.enabled).toBe(false);
  });
});
