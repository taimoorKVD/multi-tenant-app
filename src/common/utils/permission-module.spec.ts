import {
  resolvePermissionModuleName,
  formatPermissionActionName,
  formatModuleDisplayName,
  groupPermissionsByModule,
} from './permission-module';

describe('resolvePermissionModuleName', () => {
  it('maps template vs employee form permissions', () => {
    expect(resolvePermissionModuleName('archive-dc-template')).toBe('template');
    expect(resolvePermissionModuleName('view-dc-template')).toBe('template');
    expect(resolvePermissionModuleName('view-dc-assignment')).toBe('form');
    expect(resolvePermissionModuleName('complete-dc-assignment')).toBe('form');
    expect(resolvePermissionModuleName('view-dc-submission')).toBe('form');
    expect(resolvePermissionModuleName('review-dc-submission')).toBe('form');
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
    expect(formatModuleDisplayName('form')).toBe('Form');
    expect(formatModuleDisplayName('template')).toBe('Template');
    expect(formatModuleDisplayName('data-collection')).toBe('Template');
    expect(formatPermissionActionName('create-user')).toBe('Create');
    expect(formatPermissionActionName('archive-dc-template')).toBe('Archive');
    expect(formatPermissionActionName('view-dc-assignment')).toBe('View');
    expect(formatPermissionActionName('complete-dc-assignment')).toBe('Complete');
    expect(formatPermissionActionName('view-dc-submission')).toBe('View Submission');
    expect(formatPermissionActionName('review-dc-submission')).toBe('Review');
  });

  it('groups Form vs Template and hides Role / Reporting Category / Form Builder', () => {
    expect(
      groupPermissionsByModule([
        { id: 1, name: 'create-user', module: 'users' },
        { id: 3, name: 'create-form', module: 'form-builder' },
        { id: 4, name: 'create-role', module: 'roles' },
        { id: 5, name: 'view-reporting-category', module: 'reporting-categories' },
        { id: 6, name: 'archive-dc-template', module: 'data-collection' },
        { id: 7, name: 'view-dc-template', module: 'data-collection' },
        { id: 8, name: 'view-dc-assignment', module: 'data-collection' },
        { id: 9, name: 'complete-dc-assignment', module: 'data-collection' },
        { id: 10, name: 'view-dc-submission', module: 'data-collection' },
        { id: 11, name: 'review-dc-submission', module: 'data-collection' },
      ]),
    ).toEqual([
      {
        module: { name: 'User' },
        permissions: [{ id: 1, name: 'Create' }],
      },
      {
        module: { name: 'Template' },
        permissions: [
          { id: 6, name: 'Archive' },
          { id: 7, name: 'View' },
        ],
      },
      {
        module: { name: 'Form' },
        permissions: [
          { id: 8, name: 'View' },
          { id: 9, name: 'Complete' },
          { id: 10, name: 'View Submission' },
          { id: 11, name: 'Review' },
        ],
      },
    ]);
  });
});
