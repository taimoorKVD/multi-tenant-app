import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

const dashboardExample = {
  success: true,
  tenant: 'tenant_brian',
  tenant_slug: 'brian',
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
    reportingGroups: [
      {
        id: 1,
        name: 'Product Specific Items',
        description: null,
        categories: [
          { id: 1, name: 'Produce' },
          { id: 2, name: 'Meat' },
          { id: 3, name: 'Dairy' },
        ],
        categoryNames: ['Produce', 'Meat', 'Dairy'],
        itemCount: 0,
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
        summary: 'Get tenant dashboard',
        description:
          'Loads the tenant home dashboard: overview KPIs, inventory placeholders, recent activity, and reporting groups. Requires a tenant JWT (`Authorize` with access token).',
      }),
      ApiParam({
        name: 'tenantId',
        required: false,
        description: 'Optional when using /api/tenant/:tenantId/dashboard',
        example: 'brian',
      }),
      ApiResponse({
        status: 200,
        description: 'Dashboard loaded successfully.',
        schema: { example: dashboardExample },
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
