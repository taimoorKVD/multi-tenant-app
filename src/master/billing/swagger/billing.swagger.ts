import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

export const BillingSwagger = {
  ListPlans: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List subscription plans',
        description: 'Returns all Super Admin plans for the Plan Management cards and table.',
      }),
      ApiResponse({
        status: 200,
        schema: {
          example: {
            success: true,
            count: 4,
            data: [
              {
                id: 1,
                name: 'Basic',
                slug: 'basic',
                price: 250,
                formattedPrice: '€250.00',
                billingCycle: 'monthly',
                usersLimit: 10,
                storage: '20 GB',
                status: 'active',
                features: ['10 users', '20 GB storage', 'Email support'],
                allowedModules: ['dashboard', 'users', 'roles', 'jobpositions', 'locations', 'items', 'vendors'],
                modules: [
                  { key: 'dashboard', name: 'Dashboard', enabled: true },
                  { key: 'data-collection', name: 'Data Collection', enabled: false },
                ],
              },
            ],
          },
        },
      }),
    ),

  ListSubscriptions: () =>
    applyDecorators(
      ApiOperation({ summary: 'List tenant subscriptions' }),
      ApiQuery({ name: 'page', required: false }),
      ApiQuery({ name: 'limit', required: false }),
      ApiQuery({ name: 'tenant', required: false }),
      ApiQuery({ name: 'planId', required: false }),
      ApiQuery({ name: 'status', required: false }),
      ApiResponse({
        status: 200,
        schema: {
          example: {
            success: true,
            meta: { total: 1, page: 1, lastPage: 1 },
            data: [
              {
                id: 1,
                tenant: { id: 12, name: 'Acme Corporation', subdomain: 'acme' },
                plan: { id: 4, name: 'Enterprise' },
                status: 'active',
                billingCycle: 'monthly',
                formattedAmount: '€1500.00',
                nextBilling: '2026-09-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    ),

  SubscriptionStats: () =>
    applyDecorators(
      ApiOperation({ summary: 'Subscription KPI cards' }),
      ApiResponse({
        status: 200,
        schema: {
          example: {
            success: true,
            data: {
              activeSubscriptions: 112,
              mrr: { amount: 18450, formatted: '€18450.00', currency: 'EUR' },
              arr: { amount: 221400, formatted: '€221400.00', currency: 'EUR' },
              cancelledThisMonth: 3,
            },
          },
        },
      }),
    ),

  ListInvoices: () =>
    applyDecorators(
      ApiOperation({ summary: 'List invoices' }),
      ApiQuery({ name: 'page', required: false }),
      ApiQuery({ name: 'tenant', required: false }),
      ApiQuery({ name: 'status', required: false }),
      ApiQuery({ name: 'from', required: false }),
      ApiQuery({ name: 'to', required: false }),
    ),

  InvoiceStats: () =>
    applyDecorators(
      ApiOperation({ summary: 'Billing & invoice KPI cards' }),
      ApiResponse({
        status: 200,
        schema: {
          example: {
            success: true,
            data: {
              totalRevenue: { amount: 221400, formatted: '€221400.00', currency: 'EUR' },
              paidInvoices: 186,
              pendingInvoices: 12,
              overdueInvoices: 4,
            },
          },
        },
      }),
    ),
};
