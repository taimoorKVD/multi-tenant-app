import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

const adminDashboardExample = {
  success: true,
  tenant: 'tenant_brian',
  tenant_slug: 'brian',
  account_type: 'tenant_admin',
  data: {
    overview: {
      totalUsers: 48,
      totalItems: 326,
      totalVendors: 27,
      totalForms: 19,
      labels: {
        totalUsers: 'Active kitchen & floor staff',
        totalItems: 'Inventory catalog',
        totalVendors: 'Suppliers & services',
        totalForms: 'Ops & compliance forms',
      },
      breakdown: {
        formBuilderForms: 10,
        dataCollectionTemplates: 9,
      },
    },
    inventory: {
      totalItems: 326,
      lowStock: 0,
      belowPar: 0,
      orderRequired: 0,
      available: false,
    },
    recentActivity: [
      {
        id: 1,
        title: 'form updated',
        description: 'form was updated',
        createdAt: '2026-08-11T09:00:00.000Z',
        relativeTime: '12 minutes ago',
        entityType: 'form',
        action: 'update',
      },
    ],
    reportingGroups: [],
    user: { id: 1, name: 'Admin User', role: 'Admin' },
  },
};

const employeeDashboardExample = {
  success: true,
  tenant: 'tenant_brian',
  tenant_slug: 'brian',
  account_type: 'tenant_user',
  data: {
    welcome: {
      message: "Welcome Back, Omais! Here's what's on your plate today.",
      firstName: 'Omais',
      fullName: 'Omais Ahmed',
      role: 'Employee',
    },
    stats: {
      myAssignments: { value: 8, label: 'Total assigned' },
      inProgress: { value: 3, label: 'Currently in progress' },
      completed: { value: 12, label: 'This month' },
      overdue: { value: 1, label: 'Needs attention' },
    },
    todaysAssignments: [
      {
        id: 41,
        title: 'Store Daily Checklist',
        category: 'Store Operations',
        dueAt: '2026-08-12T00:00:00.000Z',
        dueLabel: 'Due Today',
        priority: 'high',
        status: 'pending',
        templateId: 7,
      },
      {
        id: 42,
        title: 'Inventory Report',
        category: 'Inventory Management',
        dueAt: '2026-08-12T00:00:00.000Z',
        dueLabel: 'Due Today',
        priority: 'high',
        status: 'in_progress',
        templateId: 8,
      },
    ],
    recentActivity: [
      {
        id: 'submitted-12',
        type: 'submitted',
        description: 'You submitted Store Daily Checklist',
        createdAt: '2026-08-12T12:20:00.000Z',
        relativeTime: '10 minutes ago',
        assignmentId: 40,
      },
      {
        id: 'started-42',
        type: 'started',
        description: 'You started Inventory Report',
        createdAt: '2026-08-12T12:05:00.000Z',
        relativeTime: '25 minutes ago',
        assignmentId: 42,
      },
      {
        id: 'assigned-45',
        type: 'assigned',
        description: 'New assignment Store Weekly Audit',
        createdAt: '2026-08-12T11:30:00.000Z',
        relativeTime: '1 hour ago',
        assignmentId: 45,
      },
      {
        id: 'draft-11',
        type: 'draft_saved',
        description: 'You saved draft for Equipment Inspection',
        createdAt: '2026-08-12T10:30:00.000Z',
        relativeTime: '2 hours ago',
        assignmentId: 44,
      },
    ],
  },
};

export const TenantDashboardSwagger = {
  Tags: () => ApiTags('Tenant - Dashboard'),
  Auth: () => ApiBearerAuth('access-token'),

  Get: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get tenant dashboard (admin or employee)',
        description:
          'Returns the home dashboard for the authenticated tenant user. `account_type: tenant_admin` gets the ops overview (users/items/vendors/forms). `account_type: tenant_user` (Employee) gets Welcome, assignment stats, today\'s assignments, and recent activity. Requires a tenant JWT.',
      }),
      ApiParam({
        name: 'tenantId',
        required: false,
        description: 'Optional when using /api/tenant/:tenantId/dashboard',
        example: 'brian',
      }),
      ApiResponse({
        status: 200,
        description: 'Dashboard loaded successfully. Shape depends on account_type.',
        schema: {
          example: employeeDashboardExample,
          oneOf: [
            { example: employeeDashboardExample },
            { example: adminDashboardExample },
          ],
        },
      }),
      ApiResponse({
        status: 401,
        description: 'Missing or invalid Bearer token.',
      }),
      ApiResponse({
        status: 500,
        description: 'Failed to load dashboard.',
      }),
    ),
};
