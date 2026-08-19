import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { StartWebsiteSignupDto } from '../public-signup/dto/start-website-signup.dto';

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
  industry: 'Restaurant',
  description: 'Multi-location restaurant group',
  countryId: 1,
  stateId: 5,
  city: 'Austin',
  address: '123 Main Street',
  postalCode: '78701',
  planId: 2,
  billingCycle: 'monthly',
  trialDays: 14,
  admin: {
    name: 'Jane Doe',
    email: 'jane@acme.com',
    password: 'Admin@123',
    confirmPassword: 'Admin@123',
  },
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
          'Public endpoint (no login). Collects tenant details, creates a Stripe Checkout session, and returns the payment URL. After payment, the tenant is created and a Tenant account ready email is sent.',
      }),
      ApiBody({ type: StartWebsiteSignupDto, examples: { default: { value: checkoutBodyExample } } }),
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
          'Public endpoint (no login). Call this on the website success page with the Stripe session_id query param.',
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
