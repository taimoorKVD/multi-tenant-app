import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

const publicPlanExample = {
  id: 2,
  name: 'Standard',
  slug: 'standard',
  description: 'For growing teams',
  price: 250,
  priceCents: 25000,
  formattedPrice: '€250.00',
  currency: 'EUR',
  billingCycle: 'monthly',
  usersLimit: 25,
  storageGb: 50,
  storage: '50 GB',
  supportLevel: 'Email support',
  features: ['25 users', '50 GB storage', 'Email support'],
  allowedModules: ['dashboard', 'users', 'roles', 'jobpositions', 'locations'],
  modules: [
    { key: 'dashboard', name: 'Dashboard', enabled: true },
    { key: 'data-collection', name: 'Data Collection', enabled: false },
  ],
  trialDays: 14,
  sortOrder: 2,
  status: 'active',
};

const checkoutBodyExample = {
  name: 'Acme Corporation',
  domain: 'acme.com',
  email: 'hello@acme.com',
  phoneCountryCode: '+1',
  phoneNumber: '2025550147',
  description: 'Multi-location restaurant group',
  countryId: 1,
  stateId: 5,
  city: 'Austin',
  address: '123 Main Street',
  postalCode: '78701',
  planId: 2,
  billingCycle: 'monthly',
  trialDays: 14,
  successUrl: 'https://yoursite.com/signup/success?session_id={CHECKOUT_SESSION_ID}',
  cancelUrl: 'https://yoursite.com/signup/cancel',
};

export const WebsiteSignupSwagger = {
  ListPlans: () =>
    applyDecorators(
      ApiOperation({
        summary: 'List active plans for the website',
        description:
          'Public endpoint (no login). Returns active subscription plans for marketing-site pricing cards.',
      }),
      ApiResponse({
        status: 200,
        description: 'Active plans retrieved successfully.',
        schema: {
          example: {
            success: true,
            count: 1,
            data: [publicPlanExample],
          },
        },
      }),
    ),

  StartCheckout: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Start Stripe Checkout for a new tenant',
        description:
          'Public endpoint (no login). Collects tenant details, creates a Stripe Checkout session, and returns the payment URL. After payment, the tenant is created. The first admin logs in with the business email and an auto-generated password (sent by email).',
      }),
      ApiBody({
        description:
          'Tenant organization details. Login uses business email; password is generated after payment.',
        schema: {
          type: 'object',
          required: ['name', 'domain', 'email', 'planId'],
          properties: {
            name: { type: 'string', example: 'Acme Corporation' },
            domain: { type: 'string', example: 'acme.com' },
            email: {
              type: 'string',
              example: 'hello@acme.com',
              description: 'Business email used as the tenant admin login.',
            },
            phoneCountryCode: { type: 'string', example: '+1' },
            phoneNumber: { type: 'string', example: '2025550147' },
            description: { type: 'string', example: 'Multi-location restaurant group' },
            countryId: { type: 'number', example: 1 },
            stateId: { type: 'number', example: 5 },
            city: { type: 'string', example: 'Austin' },
            address: { type: 'string', example: '123 Main Street' },
            postalCode: { type: 'string', example: '78701' },
            planId: { type: 'number', example: 2 },
            billingCycle: { type: 'string', example: 'monthly' },
            trialDays: { type: 'number', example: 14 },
            successUrl: {
              type: 'string',
              example: 'https://yoursite.com/signup/success?session_id={CHECKOUT_SESSION_ID}',
            },
            cancelUrl: { type: 'string', example: 'https://yoursite.com/signup/cancel' },
          },
        },
        examples: { default: { value: checkoutBodyExample } },
      }),
      ApiResponse({
        status: 201,
        description: 'Stripe Checkout session created.',
        schema: {
          example: {
            success: true,
            message: 'Continue to Stripe Checkout to complete payment.',
            data: {
              signupId: '8f3c1e2a-4b9d-4c11-9e77-2c1a0b8d4f21',
              sessionId: 'cs_test_a1b2c3',
              checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3',
              plan: { id: 2, name: 'Standard', slug: 'standard' },
            },
          },
        },
      }),
      ApiResponse({
        status: 400,
        description: 'Invalid payload, plan unavailable, domain already taken, or Stripe is not configured.',
        schema: {
          example: {
            statusCode: 400,
            message: 'Selected plan is not available',
            error: 'Bad Request',
          },
        },
      }),
    ),

  SignupStatus: () =>
    applyDecorators(
      ApiOperation({
        summary: 'Get website signup payment status',
        description:
          'Public endpoint (no login). Poll this on the website success page with Stripe session_id. When provisioned, password and loginUrl are returned so the user can be signed in automatically.',
      }),
      ApiQuery({
        name: 'session_id',
        required: true,
        example: 'cs_test_a1b2c3',
        description: 'Stripe Checkout session id, or the signup id returned by checkout.',
      }),
      ApiResponse({
        status: 200,
        description: 'Signup status retrieved successfully.',
        schema: {
          example: {
            success: true,
            data: {
              signupId: '8f3c1e2a-4b9d-4c11-9e77-2c1a0b8d4f21',
              status: 'provisioned',
              email: 'hello@acme.com',
              password: 'K7m$pQ2nLx9w',
              loginUrl: 'https://acme.eusocial.com/login',
              tenantId: 12,
              paid: true,
              provisioned: true,
              error: null,
            },
          },
        },
      }),
      ApiResponse({
        status: 404,
        description: 'Signup session not found.',
        schema: {
          example: {
            statusCode: 404,
            message: 'Signup session not found',
            error: 'Not Found',
          },
        },
      }),
    ),
};
