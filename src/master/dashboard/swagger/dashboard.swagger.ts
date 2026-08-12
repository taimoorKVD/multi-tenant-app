import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

const dashboardExample = {
  success: true,
  user_type: 'master',
  data: {
    kpis: {
      totalTenants: {
        value: 128,
        change: 12,
        changeType: 'count',
        changeLabel: '+12 this month',
        trend: [80, 86, 90, 95, 99, 104, 108, 112, 116, 118, 122, 128],
        available: true,
      },
      activeTenants: {
        value: 128,
        change: 12,
        changeType: 'count',
        changeLabel: '+12 this month',
        trend: [80, 86, 90, 95, 99, 104, 108, 112, 116, 118, 122, 128],
        available: true,
      },
      totalUsers: {
        value: 4,
        change: 1,
        changeType: 'count',
        changeLabel: '+1 this month',
        trend: [1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4],
        available: true,
      },
      mrr: {
        value: 0,
        change: 0,
        changeType: 'percent',
        changeLabel: '+0.0% this month',
        trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        available: false,
        currency: 'EUR',
      },
      activeSubscriptions: {
        value: 0,
        change: 0,
        changeType: 'count',
        changeLabel: '+0 this month',
        trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        available: false,
      },
      platformRevenue: {
        value: 0,
        change: 0,
        changeType: 'percent',
        changeLabel: '+0.0% this month',
        trend: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        available: false,
        currency: 'EUR',
      },
    },
    tenantsOverview: {
      period: 'this_month',
      series: {
        newTenants: [
          { date: '2026-08-01', count: 1 },
          { date: '2026-08-10', count: 2 },
        ],
        activeTenants: [
          { date: '2026-08-01', count: 117 },
          { date: '2026-08-10', count: 119 },
        ],
      },
      summary: {
        newTenants: 12,
        upgraded: 0,
        downgraded: 0,
        cancelled: 0,
      },
    },
    planDistribution: {
      available: false,
      total: 128,
      segments: [{ key: 'unassigned', name: 'Unassigned', count: 128, percentage: 100 }],
    },
    recentTenants: [
      {
        id: 12,
        name: 'Acme Corporation',
        domain: 'acme.eusocial.com',
        subdomain: 'acme',
        customDomain: null,
        plan: null,
        status: 'Active',
        users: 24,
        joinedOn: '2026-08-10T09:00:00.000Z',
      },
    ],
    systemHealth: {
      database: {
        status: 'healthy',
        label: 'All systems operational',
        available: true,
      },
      storage: {
        status: 'unknown',
        label: 'Storage is not monitored',
        usedPercent: null,
        usedGb: null,
        totalGb: null,
        available: false,
      },
      email: {
        status: 'healthy',
        label: 'All emails delivered',
        available: true,
        sentToday: 18,
        failedToday: 0,
        pending: 0,
      },
      api: {
        status: 'healthy',
        label: 'Response time: 128ms',
        avgLatencyMs: 128,
        failedToday: 0,
        available: true,
      },
    },
  },
};

export const MasterDashboardSwagger = {
  Tags: () => ApiTags('Super Admin - Dashboard'),
  Auth: () => ApiBearerAuth('access-token'),

  Get: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get Super Admin dashboard',
        description:
          'Loads the Super Admin home: KPI cards (with sparkline trend + this-month change), tenants overview chart, plan distribution, recent tenants, and system health. Billing/plan/storage fields return `available: false` until those modules exist. Requires a master JWT from POST /api/master/login.',
      }),
      ApiResponse({
        status: 200,
        description: 'Dashboard loaded successfully.',
        schema: { example: dashboardExample },
      }),
      ApiResponse({
        status: 401,
        description: 'Missing or invalid master Bearer token.',
      }),
      ApiResponse({
        status: 500,
        description: 'Failed to load dashboard.',
      }),
    ),
};
