import {
  resolvePermissionModuleName,
  formatPermissionActionName,
  formatModuleDisplayName,
  formatPermissionDeniedMessage,
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
    expect(resolvePermissionModuleName('view-reporting-group')).toBe('reporting-groups');
    expect(resolvePermissionModuleName('create-reporting-category')).toBe('reporting-groups');
  });

  it('maps billing permissions', () => {
    expect(resolvePermissionModuleName('view-plan')).toBe('billing');
    expect(resolvePermissionModuleName('edit-invoice')).toBe('billing');
  });
});

describe('display helpers', () => {
  it('formats module and action labels', () => {
    expect(formatModuleDisplayName('users')).toBe('User');
    expect(formatModuleDisplayName('form')).toBe('Task');
    expect(formatModuleDisplayName('template')).toBe('Form Template');
    expect(formatModuleDisplayName('data-collection')).toBe('Form Template');
    expect(formatPermissionActionName('create-user')).toBe('Create');
    expect(formatPermissionActionName('archive-dc-template')).toBe('Archive');
    expect(formatPermissionActionName('activate-dc-template')).toBe('Restore');
    expect(formatPermissionActionName('view-dc-assignment')).toBe('View');
    expect(formatPermissionActionName('complete-dc-assignment')).toBe('Submit');
    expect(formatPermissionActionName('review-dc-submission')).toBe('Review');
    expect(formatPermissionActionName('view-dc-submission')).toBe('View Submission');
  });

  it('does not confuse view-dc-submission denial with Task View', () => {
    expect(formatPermissionDeniedMessage(['view-dc-submission'])).toBe(
      'You do not have View Submission permission for Task.',
    );
    expect(formatPermissionDeniedMessage(['review-dc-submission'])).toBe(
      'You do not have Review permission for Task.',
    );
  });

  it('formats clear permission denied messages by module', () => {
    expect(formatPermissionDeniedMessage(['create-user'])).toBe(
      'You do not have Create permission for User.',
    );
    expect(formatPermissionDeniedMessage(['create-user', 'view-user'])).toBe(
      'You do not have Create or View permission for User.',
    );
    expect(formatPermissionDeniedMessage(['view-dc-template', 'complete-dc-assignment'])).toBe(
      'You do not have View permission for Form Template or Submit permission for Task.',
    );
    expect(formatPermissionDeniedMessage([])).toBe(
      'You do not have permission for this resource.',
    );
  });

  it('groups Task vs Form Template and hides Role / Form Builder / View Submission', () => {
    expect(
      groupPermissionsByModule([
        { id: 1, name: 'create-user', module: 'users' },
        { id: 3, name: 'create-form', module: 'form-builder' },
        { id: 4, name: 'create-role', module: 'roles' },
        { id: 5, name: 'view-reporting-group', module: 'reporting-groups' },
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
        module: { name: 'Reporting Group' },
        permissions: [{ id: 5, name: 'View' }],
      },
      {
        module: { name: 'Form Template' },
        permissions: [
          { id: 6, name: 'Archive' },
          { id: 7, name: 'View' },
        ],
      },
      {
        module: { name: 'Task' },
        permissions: [
          { id: 8, name: 'View' },
          { id: 9, name: 'Submit' },
          { id: 11, name: 'Review' },
        ],
      },
    ]);
  });
});
