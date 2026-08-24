import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { Plan } from './entities';

function resolveStripeConstructor(): new (secret: string) => Stripe {
  // Stripe v22 CJS exports the constructor as module.exports. Nest/ts-node
  // without esModuleInterop compiles `import Stripe from 'stripe'` to
  // `new stripe_1.default()`, which is not constructable.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded = require('stripe');
  const ctor = typeof loaded === 'function' ? loaded : loaded?.Stripe || loaded?.default;
  if (typeof ctor !== 'function') {
    throw new InternalServerErrorException('Unable to load the Stripe SDK constructor');
  }
  return ctor;
}

const StripeClient = resolveStripeConstructor();

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  private secretKey(): string {
    return String(process.env.STRIPE_SECRET_KEY || '')
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }

  isConfigured(): boolean {
    const secret = this.secretKey();
    return secret.startsWith('sk_test_') || secret.startsWith('sk_live_') || secret.startsWith('rk_');
  }

  getClient(): Stripe {
    if (this.client) return this.client;
    const secret = this.secretKey();
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY to a sk_test_ or sk_live_ key.',
      );
    }
    this.client = new StripeClient(secret);
    this.logger.log(
      `Stripe client initialised (${secret.startsWith('sk_live_') ? 'live' : 'test'} mode)`,
    );
    return this.client;
  }

  private rethrow(error: unknown, fallback = 'Stripe request failed'): never {
    const stripeError = error as { message?: string; raw?: { message?: string }; type?: string };
    const message = stripeError?.raw?.message || stripeError?.message || fallback;
    this.logger.error(`Stripe error: ${message}`);
    throw new BadRequestException(message);
  }

  getWebhookSecret(): string | null {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim().replace(/^['"]|['"]$/g, '');
    return secret || null;
  }

  getCurrency(): string {
    return (process.env.STRIPE_CURRENCY || 'eur').trim().toLowerCase();
  }

  toCents(amount: number): number {
    return Math.round(Number(amount) * 100);
  }

  fromCents(cents: number): number {
    return Number((Number(cents || 0) / 100).toFixed(2));
  }

  slugify(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);
  }

  async ensureProductAndPrice(plan: Plan): Promise<{
    productId: string;
    priceId: string;
    yearlyPriceId: string;
  }> {
    try {
      const stripe = this.getClient();
      let productId = plan.stripeProductId || undefined;

      if (productId) {
        try {
          await stripe.products.update(productId, {
            name: plan.name,
            description: plan.description || undefined,
            active: plan.status === 'active',
            metadata: { planId: String(plan.id), slug: plan.slug },
          });
        } catch {
          productId = undefined;
        }
      }

      if (!productId) {
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description || undefined,
          active: plan.status === 'active',
          metadata: { planId: String(plan.id), slug: plan.slug },
        });
        productId = product.id;
      }

      const yearlyCents =
        plan.yearlyPriceCents && plan.yearlyPriceCents > 0
          ? plan.yearlyPriceCents
          : plan.priceCents * 12;

      const priceId = await this.ensureRecurringPrice(stripe, {
        productId,
        existingPriceId: plan.stripePriceId,
        unitAmount: plan.priceCents,
        currency: plan.currency,
        interval: 'month',
        planId: plan.id,
        slug: plan.slug,
      });
      const yearlyPriceId = await this.ensureRecurringPrice(stripe, {
        productId,
        existingPriceId: plan.stripeYearlyPriceId,
        unitAmount: yearlyCents,
        currency: plan.currency,
        interval: 'year',
        planId: plan.id,
        slug: plan.slug,
      });

      return { productId, priceId, yearlyPriceId };
    } catch (error) {
      this.rethrow(error, 'Failed to sync plan to Stripe');
    }
  }

  private async ensureRecurringPrice(
    stripe: Stripe,
    params: {
      productId: string;
      existingPriceId?: string | null;
      unitAmount: number;
      currency: string;
      interval: 'month' | 'year';
      planId: number;
      slug: string;
    },
  ): Promise<string> {
    const currency = params.currency.toLowerCase();
    if (params.existingPriceId) {
      try {
        const existing = await stripe.prices.retrieve(params.existingPriceId);
        if (
          existing.active &&
          existing.unit_amount === params.unitAmount &&
          existing.recurring?.interval === params.interval &&
          existing.currency === currency
        ) {
          return existing.id;
        }
      } catch {
        // Create a new price below.
      }
    }

    const price = await stripe.prices.create({
      product: params.productId,
      unit_amount: params.unitAmount,
      currency,
      recurring: { interval: params.interval },
      metadata: {
        planId: String(params.planId),
        slug: params.slug,
        interval: params.interval,
      },
    });

    if (params.existingPriceId) {
      try {
        await stripe.prices.update(params.existingPriceId, { active: false });
      } catch (error) {
        this.logger.warn(`Failed to archive previous Stripe price ${params.existingPriceId}: ${error}`);
      }
    }

    return price.id;
  }

  async archiveProduct(plan: Plan): Promise<void> {
    if (!this.isConfigured() || !plan.stripeProductId) return;
    try {
      const stripe = this.getClient();
      await stripe.products.update(plan.stripeProductId, { active: false });
      if (plan.stripePriceId) {
        await stripe.prices.update(plan.stripePriceId, { active: false });
      }
      if (plan.stripeYearlyPriceId) {
        await stripe.prices.update(plan.stripeYearlyPriceId, { active: false });
      }
    } catch (error) {
      this.logger.warn(`Failed to archive Stripe product ${plan.stripeProductId}: ${error}`);
    }
  }

  async ensureCustomer(params: {
    customerId?: string | null;
    name: string;
    email?: string | null;
    tenantId: number;
    subdomain: string;
  }): Promise<string> {
    try {
      const stripe = this.getClient();
      if (params.customerId) {
        try {
          await stripe.customers.update(params.customerId, {
            name: params.name,
            email: params.email || undefined,
            metadata: { tenantId: String(params.tenantId), subdomain: params.subdomain },
          });
          return params.customerId;
        } catch {
          // Customer id from another Stripe account; create a new one.
        }
      }

      const customer = await stripe.customers.create({
        name: params.name,
        email: params.email || undefined,
        metadata: { tenantId: String(params.tenantId), subdomain: params.subdomain },
      });
      return customer.id;
    } catch (error) {
      this.rethrow(error, 'Failed to create Stripe customer');
    }
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    paymentMethodId?: string;
    metadata: Record<string, string>;
  }) {
    try {
      const stripe = this.getClient();
      if (params.paymentMethodId) {
        await stripe.paymentMethods.attach(params.paymentMethodId, {
          customer: params.customerId,
        });
        await stripe.customers.update(params.customerId, {
          invoice_settings: { default_payment_method: params.paymentMethodId },
        });
      }

      const hasTrial = Boolean(params.trialDays && params.trialDays > 0);
      return await stripe.subscriptions.create({
        customer: params.customerId,
        items: [{ price: params.priceId }],
        trial_period_days: hasTrial ? params.trialDays : undefined,
        ...(hasTrial
          ? {}
          : {
              payment_behavior: 'default_incomplete' as const,
              payment_settings: { save_default_payment_method: 'on_subscription' as const },
            }),
        expand: ['latest_invoice'],
        metadata: params.metadata,
      });
    } catch (error) {
      this.rethrow(error, 'Failed to create Stripe subscription');
    }
  }

  async changeSubscriptionPrice(stripeSubscriptionId: string, priceId: string, prorate = true) {
    try {
      const stripe = this.getClient();
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const itemId = subscription.items.data[0]?.id;
      if (!itemId) {
        throw new InternalServerErrorException('Stripe subscription has no items to update');
      }

      return await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: itemId, price: priceId }],
        proration_behavior: prorate ? 'create_prorations' : 'none',
        expand: ['latest_invoice'],
      });
    } catch (error) {
      this.rethrow(error, 'Failed to change Stripe subscription');
    }
  }

  async cancelSubscription(stripeSubscriptionId: string, atPeriodEnd = true) {
    try {
      const stripe = this.getClient();
      if (atPeriodEnd) {
        return await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
      }
      return await stripe.subscriptions.cancel(stripeSubscriptionId);
    } catch (error) {
      this.rethrow(error, 'Failed to cancel Stripe subscription');
    }
  }

  async retrieveSubscription(subscriptionId: string) {
    try {
      return await this.getClient().subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice'],
      });
    } catch (error) {
      this.rethrow(error, 'Failed to retrieve Stripe subscription');
    }
  }

  async createCheckoutSession(params: {
    priceId: string;
    customerEmail: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    trialDays?: number;
    clientReferenceId?: string;
  }) {
    try {
      const stripe = this.getClient();
      const hasTrial = Boolean(params.trialDays && params.trialDays > 0);
      return await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: params.customerEmail,
        client_reference_id: params.clientReferenceId,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        line_items: [{ price: params.priceId, quantity: 1 }],
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
        metadata: params.metadata,
        subscription_data: {
          metadata: params.metadata,
          trial_period_days: hasTrial ? params.trialDays : undefined,
        },
      });
    } catch (error) {
      this.rethrow(error, 'Failed to create Stripe Checkout session');
    }
  }

  async retrieveCheckoutSession(sessionId: string) {
    try {
      return await this.getClient().checkout.sessions.retrieve(sessionId);
    } catch (error) {
      this.rethrow(error, 'Failed to retrieve Stripe Checkout session');
    }
  }

  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    try {
      return this.getClient().webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      this.rethrow(error, 'Invalid Stripe webhook signature');
    }
  }

  unixToDate(value?: number | null): Date | null {
    if (!value) return null;
    return new Date(value * 1000);
  }
}
