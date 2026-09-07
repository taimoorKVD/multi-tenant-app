import { resolvePermissionModuleName, formatPermissionActionName, formatModuleDisplayName, groupPermissionsByModule } from './permission-module';

describe('resolvePermissionModuleName', () => {
  it('maps data-collection permissions', () => {
    expect(resolvePermissionModuleName('archive-dc-template')).toBe('data-collection');
    expect(resolvePermissionModuleName('view-dc-assignment')).toBe('data-collection');
  });

  it('maps core tenant modules', () => {
    expect(resolvePermissionModuleName('view-user')).toBe('users');
    expect(resolvePermissionModuleName('create-role')).toBe('roles');
    expect(resolvePermissionModuleName('view-permission')).toBe('roles');
    expect(resolvePermissionModuleName('create-job-position')).toBe('jobpositions');
    expect(resolvePermissionModuleName('submit-form')).toBe('form-builder');
  });

  it('maps billing permissions', () => {
    expect(resolvePermissionModuleName('view-plan')).toBe('billing');
    expect(resolvePermissionModuleName('edit-invoice')).toBe('billing');
  });
});

describe('display helpers', () => {
  it('formats module and action labels', () => {
    expect(formatModuleDisplayName('users')).toBe('User');
    expect(formatModuleDisplayName('form-builder')).toBe('Form');
    expect(formatModuleDisplayName('data-collection')).toBe('Template');
    expect(formatPermissionActionName('create-user')).toBe('Create');
    expect(formatPermissionActionName('archive-dc-template')).toBe('Archive');
  });

  it('groups permissions by module and hides Role / Reporting Category', () => {
    expect(
      groupPermissionsByModule([
        { id: 1, name: 'create-user', module: 'users' },
        { id: 2, name: 'view-user', module: 'users' },
        { id: 3, name: 'create-form', module: 'form-builder' },
        { id: 4, name: 'create-role', module: 'roles' },
        { id: 5, name: 'view-reporting-category', module: 'reporting-categories' },
        { id: 6, name: 'archive-dc-template', module: 'data-collection' },
      ]),
    ).toEqual([
      {
        module: { name: 'User' },
        permissions: [
          { id: 1, name: 'Create' },
          { id: 2, name: 'View' },
        ],
      },
      {
        module: { name: 'Form' },
        permissions: [{ id: 3, name: 'Create' }],
      },
      {
        module: { name: 'Template' },
        permissions: [{ id: 6, name: 'Archive' }],
      },
    ]);
  });
});
