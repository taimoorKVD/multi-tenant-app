import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { BillingCycle, Plan } from './entities';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  }

  getClient(): Stripe {
    if (this.client) return this.client;
    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) {
      throw new InternalServerErrorException(
        'Stripe is not configured. Set STRIPE_SECRET_KEY in the environment.',
      );
    }
    this.client = new Stripe(secret);
    return this.client;
  }

  getWebhookSecret(): string | null {
    return process.env.STRIPE_WEBHOOK_SECRET?.trim() || null;
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

  async ensureProductAndPrice(plan: Plan): Promise<{ productId: string; priceId: string }> {
    const stripe = this.getClient();
    let productId = plan.stripeProductId || undefined;

    if (productId) {
      await stripe.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
        active: plan.status === 'active',
        metadata: { planId: String(plan.id), slug: plan.slug },
      });
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description || undefined,
        active: plan.status === 'active',
        metadata: { planId: String(plan.id), slug: plan.slug },
      });
      productId = product.id;
    }

    const interval = plan.billingCycle === BillingCycle.YEARLY ? 'year' : 'month';
    const needsNewPrice =
      !plan.stripePriceId ||
      plan.currency.toLowerCase() !== this.getCurrency();

    if (!needsNewPrice && plan.stripePriceId) {
      const existing = await stripe.prices.retrieve(plan.stripePriceId);
      if (
        existing.unit_amount === plan.priceCents &&
        existing.recurring?.interval === interval &&
        existing.currency === plan.currency.toLowerCase()
      ) {
        return { productId, priceId: existing.id };
      }
    }

    const price = await stripe.prices.create({
      product: productId,
      unit_amount: plan.priceCents,
      currency: plan.currency.toLowerCase(),
      recurring: { interval },
      metadata: { planId: String(plan.id), slug: plan.slug },
    });

    if (plan.stripePriceId) {
      try {
        await stripe.prices.update(plan.stripePriceId, { active: false });
      } catch (error) {
        this.logger.warn(`Failed to archive previous Stripe price ${plan.stripePriceId}: ${error}`);
      }
    }

    return { productId, priceId: price.id };
  }

  async archiveProduct(plan: Plan): Promise<void> {
    if (!this.isConfigured() || !plan.stripeProductId) return;
    const stripe = this.getClient();
    await stripe.products.update(plan.stripeProductId, { active: false });
    if (plan.stripePriceId) {
      await stripe.prices.update(plan.stripePriceId, { active: false });
    }
  }

  async ensureCustomer(params: {
    customerId?: string | null;
    name: string;
    email?: string | null;
    tenantId: number;
    subdomain: string;
  }): Promise<string> {
    const stripe = this.getClient();
    if (params.customerId) {
      await stripe.customers.update(params.customerId, {
        name: params.name,
        email: params.email || undefined,
        metadata: { tenantId: String(params.tenantId), subdomain: params.subdomain },
      });
      return params.customerId;
    }

    const customer = await stripe.customers.create({
      name: params.name,
      email: params.email || undefined,
      metadata: { tenantId: String(params.tenantId), subdomain: params.subdomain },
    });
    return customer.id;
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    paymentMethodId?: string;
    metadata: Record<string, string>;
  }) {
    const stripe = this.getClient();
    if (params.paymentMethodId) {
      await stripe.paymentMethods.attach(params.paymentMethodId, {
        customer: params.customerId,
      });
      await stripe.customers.update(params.customerId, {
        invoice_settings: { default_payment_method: params.paymentMethodId },
      });
    }

    return stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      trial_period_days: params.trialDays && params.trialDays > 0 ? params.trialDays : undefined,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: params.metadata,
    });
  }

  async changeSubscriptionPrice(stripeSubscriptionId: string, priceId: string, prorate = true) {
    const stripe = this.getClient();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      throw new InternalServerErrorException('Stripe subscription has no items to update');
    }

    return stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: prorate ? 'create_prorations' : 'none',
      expand: ['latest_invoice'],
    });
  }

  async cancelSubscription(stripeSubscriptionId: string, atPeriodEnd = true) {
    const stripe = this.getClient();
    if (atPeriodEnd) {
      return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
    }
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  constructWebhookEvent(payload: Buffer | string, signature: string): Stripe.Event {
    const secret = this.getWebhookSecret();
    if (!secret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.getClient().webhooks.constructEvent(payload, signature, secret);
  }

  unixToDate(value?: number | null): Date | null {
    if (!value) return null;
    return new Date(value * 1000);
  }
}
