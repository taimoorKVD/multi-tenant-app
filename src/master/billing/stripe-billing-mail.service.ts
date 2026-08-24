import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities';
import { Invoice, Subscription, WebsiteSignup } from './entities';
import { EMAIL_COLORS, emailEscape, renderEmailLayout } from '../../mail/utils/email-layout.util';

export type StripeMailContext = {
  tenant?: Tenant | null;
  subscription?: Subscription | null;
  invoice?: Invoice | null;
  signup?: WebsiteSignup | null;
  /** Customer-facing detail rows (plan, amount, etc.). */
  details?: Record<string, string | null | undefined>;
  /** Ops-only rows (Stripe event ids). Sent only to BILLING_NOTIFY_EMAIL. */
  internalDetails?: Record<string, string | null | undefined>;
};

type MailTemplate = {
  subject: string;
  heading: string;
  intro: string;
  accent: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
};

@Injectable()
export class StripeBillingMailService {
  private readonly logger = new Logger(StripeBillingMailService.name);

  constructor(
    @InjectRepository(WebsiteSignup)
    private readonly signupRepo: Repository<WebsiteSignup>,
  ) {}

  async notify(eventType: string, context: StripeMailContext): Promise<void> {
    const template = this.templateFor(eventType, context);
    if (!template) return;

    const customerRecipients = this.customerRecipients(context);
    const opsRecipient = this.opsRecipient();
    if (!customerRecipients.length && !opsRecipient) {
      this.logger.warn(`No billing email recipient for Stripe event ${eventType}`);
      return;
    }

    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      this.logger.warn('SMTP is not configured; Stripe billing email was skipped');
      return;
    }

    const customerHtml = this.renderHtml(template, context, { includeInternal: false });
    const opsHtml = this.renderHtml(template, context, { includeInternal: true });
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username
        ? { user: smtp.username, pass: smtp.password || undefined }
        : undefined,
    });

    try {
      for (const to of customerRecipients) {
        // Avoid duplicating the customer email when ops address matches a customer.
        if (opsRecipient && to === opsRecipient) continue;
        await transporter.sendMail({
          from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
          to,
          replyTo: smtp.replyTo || undefined,
          subject: template.subject,
          html: customerHtml,
        });
        this.logger.log(`Stripe billing email (${eventType}) sent to ${to}`);
      }

      if (opsRecipient) {
        await transporter.sendMail({
          from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
          to: opsRecipient,
          replyTo: smtp.replyTo || undefined,
          subject: `[Ops] ${template.subject}`,
          html: opsHtml,
        });
        this.logger.log(`Stripe billing ops email (${eventType}) sent to ${opsRecipient}`);
      }
    } finally {
      transporter.close();
    }
  }

  async findSignupByCheckout(session: { id?: string; metadata?: Record<string, string> | null }) {
    const signupId = session.metadata?.signupId;
    if (signupId) {
      const byId = await this.signupRepo.findOne({ where: { id: signupId } });
      if (byId) return byId;
    }
    if (session.id) {
      return this.signupRepo.findOne({ where: { stripeCheckoutSessionId: session.id } });
    }
    return null;
  }

  private customerRecipients(context: StripeMailContext): string[] {
    const list = [context.tenant?.email, context.signup?.email]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(list)];
  }

  private opsRecipient(): string | null {
    const value = process.env.BILLING_NOTIFY_EMAIL?.trim().toLowerCase();
    return value || null;
  }

  private templateFor(eventType: string, context: StripeMailContext): MailTemplate | null {
    const tenantName = context.tenant?.name || 'your workspace';
    const templates: Record<string, MailTemplate> = {
      'customer.subscription.created': {
        subject: `Subscription started for ${tenantName}`,
        heading: 'Subscription started',
        intro: `A new subscription is now active for <strong>${this.escape(tenantName)}</strong>. Your workspace billing is in good standing.`,
        accent: '#0b73e6',
        badge: 'Active',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'customer.subscription.updated': {
        subject: `Subscription updated for ${tenantName}`,
        heading: 'Subscription updated',
        intro: `Billing details for <strong>${this.escape(tenantName)}</strong> were updated. Review the summary below.`,
        accent: '#0b73e6',
        badge: 'Updated',
        badgeBg: '#e8f1fb',
        badgeColor: '#0b73e6',
      },
      'customer.subscription.paused': {
        subject: `Subscription paused for ${tenantName}`,
        heading: 'Subscription paused',
        intro: `The subscription for <strong>${this.escape(tenantName)}</strong> is paused. Access may be limited until billing resumes.`,
        accent: '#d97706',
        badge: 'Paused',
        badgeBg: '#fef3cd',
        badgeColor: '#856404',
      },
      'customer.subscription.resumed': {
        subject: `Subscription resumed for ${tenantName}`,
        heading: 'Subscription resumed',
        intro: `The subscription for <strong>${this.escape(tenantName)}</strong> is active again. Workspace access has been restored.`,
        accent: '#1b7f4e',
        badge: 'Resumed',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'customer.subscription.deleted': {
        subject: `Subscription cancelled for ${tenantName}`,
        heading: 'Subscription cancelled',
        intro: `The subscription for <strong>${this.escape(tenantName)}</strong> was cancelled. The workspace has been suspended until a new plan is started.`,
        accent: '#c0392b',
        badge: 'Cancelled',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
      'invoice.finalized': {
        subject: `Invoice issued for ${tenantName}`,
        heading: 'Invoice issued',
        intro: `A new invoice has been finalized for <strong>${this.escape(tenantName)}</strong>. Payment will be collected according to your billing cycle.`,
        accent: '#0b73e6',
        badge: 'Invoice',
        badgeBg: '#e8f1fb',
        badgeColor: '#0b73e6',
      },
      'invoice.paid': {
        subject: `Payment received for ${tenantName}`,
        heading: 'Payment received',
        intro: `We received a successful payment for <strong>${this.escape(tenantName)}</strong>. Thank you — your subscription remains in good standing.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'invoice.payment_succeeded': {
        subject: `Payment received for ${tenantName}`,
        heading: 'Payment received',
        intro: `A payment succeeded for <strong>${this.escape(tenantName)}</strong>. Your invoice has been marked as paid.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'invoice.payment_failed': {
        subject: `Payment failed for ${tenantName}`,
        heading: 'Payment failed',
        intro: `A charge for <strong>${this.escape(tenantName)}</strong> could not be completed. Please update the payment method to avoid interruption.`,
        accent: '#c0392b',
        badge: 'Failed',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
      'invoice.payment_action_required': {
        subject: `Payment action required for ${tenantName}`,
        heading: 'Payment action required',
        intro: `An extra verification step is needed to complete payment for <strong>${this.escape(tenantName)}</strong>. Open the invoice link below to finish.`,
        accent: '#d97706',
        badge: 'Action required',
        badgeBg: '#fef3cd',
        badgeColor: '#856404',
      },
      'invoice.voided': {
        subject: `Invoice voided for ${tenantName}`,
        heading: 'Invoice voided',
        intro: `An invoice for <strong>${this.escape(tenantName)}</strong> was voided and will not be collected.`,
        accent: '#6b7280',
        badge: 'Voided',
        badgeBg: '#f3f4f6',
        badgeColor: '#4b5563',
      },
      'invoice.marked_uncollectible': {
        subject: `Invoice uncollectible for ${tenantName}`,
        heading: 'Invoice uncollectible',
        intro: `An invoice for <strong>${this.escape(tenantName)}</strong> was marked uncollectible. Please contact billing support if this was unexpected.`,
        accent: '#c0392b',
        badge: 'Uncollectible',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
      'checkout.session.completed': {
        subject: `Payment confirmed for ${tenantName}`,
        heading: 'Payment confirmed',
        intro: `Payment for <strong>${this.escape(tenantName)}</strong> was successful. Your workspace will be provisioned if it is not already ready.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'checkout.session.async_payment_succeeded': {
        subject: `Payment confirmed for ${tenantName}`,
        heading: 'Payment confirmed',
        intro: `Your delayed payment for <strong>${this.escape(tenantName)}</strong> succeeded. Workspace provisioning will continue if needed.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'checkout.session.expired': {
        subject: `Checkout expired for ${tenantName}`,
        heading: 'Checkout expired',
        intro: `The checkout for <strong>${this.escape(tenantName)}</strong> expired before payment was completed. Start checkout again to finish signup.`,
        accent: '#d97706',
        badge: 'Expired',
        badgeBg: '#fef3cd',
        badgeColor: '#856404',
      },
      'checkout.session.async_payment_failed': {
        subject: `Payment failed for ${tenantName}`,
        heading: 'Payment failed',
        intro: `A delayed payment for <strong>${this.escape(tenantName)}</strong> failed. No workspace was activated for this attempt.`,
        accent: '#c0392b',
        badge: 'Failed',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
      'customer.deleted': {
        subject: `Billing account removed for ${tenantName}`,
        heading: 'Billing account removed',
        intro: `The billing account for <strong>${this.escape(tenantName)}</strong> was removed. The workspace has been suspended.`,
        accent: '#c0392b',
        badge: 'Suspended',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
    };

    return templates[eventType] || null;
  }

  private renderHtml(
    template: MailTemplate,
    context: StripeMailContext,
    options: { includeInternal: boolean },
  ): string {
    const rows = this.detailRows(context, options);
    return renderEmailLayout({
      logoUrl: this.getLogoUrl(),
      brandTitle: 'EuSocial',
      title: template.heading,
      preheader: template.subject,
      accent: template.accent,
      badge: {
        label: template.badge,
        bg: template.badgeBg,
        color: template.badgeColor,
      },
      introHtml: `<p style="margin:0;">${template.intro}</p>`,
      rows: rows.map(([label, value]) => ({
        label,
        value,
        html: true,
      })),
      footerNote: options.includeInternal
        ? `Internal billing notification from EuSocial. © ${new Date().getFullYear()} EuSocial.`
        : `This is a billing update from EuSocial. © ${new Date().getFullYear()} EuSocial.`,
    });
  }

  private getLogoUrl(): string {
    const configured = process.env.EMAIL_LOGO_URL?.trim() || process.env.MAIL_LOGO_URL?.trim();
    if (configured) return configured;
    const frontend =
      process.env.FRONTEND_URL?.trim() ||
      process.env.APP_FRONTEND_URL?.trim() ||
      'http://localhost:4200';
    return `${frontend.replace(/\/+$/, '')}/assets/eusocial-logo.png`;
  }

  private detailRows(
    context: StripeMailContext,
    options: { includeInternal: boolean },
  ): Array<[string, string]> {
    const invoiceMoney = context.invoice
      ? `${(Number(context.invoice.amountCents || 0) / 100).toFixed(2)} ${(context.invoice.currency || '').toUpperCase()}`
      : null;
    const invoiceLink = context.invoice?.hostedInvoiceUrl
      ? `<a href="${emailEscape(context.invoice.hostedInvoiceUrl)}" style="color:${EMAIL_COLORS.link};text-decoration:none;">View invoice</a>`
      : null;

    const rows: Array<[string, string | null | undefined]> = [
      ['Workspace', context.tenant?.name ? emailEscape(context.tenant.name) : null],
      ['Domain', context.tenant?.subdomain ? emailEscape(context.tenant.subdomain) : null],
      ['Workspace status', context.tenant?.status ? emailEscape(context.tenant.status) : null],
      ['Plan', context.subscription?.plan?.name ? emailEscape(context.subscription.plan.name) : null],
      [
        'Subscription status',
        context.subscription?.status ? emailEscape(context.subscription.status) : null,
      ],
      [
        'Billing cycle',
        context.subscription?.billingCycle ? emailEscape(context.subscription.billingCycle) : null,
      ],
      [
        'Invoice number',
        context.invoice?.invoiceNumber ? emailEscape(context.invoice.invoiceNumber) : null,
      ],
      ['Amount', invoiceMoney ? emailEscape(invoiceMoney) : null],
      ['Invoice status', context.invoice?.status ? emailEscape(context.invoice.status) : null],
      ['Invoice', invoiceLink],
      ['Email', context.signup?.email ? emailEscape(context.signup.email) : null],
      ['Signup status', context.signup?.status ? emailEscape(context.signup.status) : null],
    ];

    Object.entries(context.details || {}).forEach(([label, value]) => {
      rows.push([label, value != null ? emailEscape(String(value)) : null]);
    });

    if (options.includeInternal) {
      Object.entries(context.internalDetails || {}).forEach(([label, value]) => {
        rows.push([label, value != null ? emailEscape(String(value)) : null]);
      });
    }

    return rows
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => [label, String(value)]) as Array<[string, string]>;
  }

  private escape(value: string) {
    return emailEscape(value);
  }

  private resolveSmtpConfig() {
    const fromEmail =
      process.env.SMTP_FROM?.trim() ||
      process.env.EMAIL_FROM?.trim() ||
      process.env.MAIL_FROM_EMAIL?.trim() ||
      process.env.SMTP_USER?.trim() ||
      null;
    return {
      host: process.env.SMTP_HOST?.trim() || null,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      username: process.env.SMTP_USER?.trim() || null,
      password: process.env.SMTP_PASS?.trim() || null,
      fromEmail,
      fromName: process.env.SMTP_FROM_NAME?.trim() || 'EuSocial',
      replyTo: process.env.SMTP_REPLY_TO?.trim() || null,
    };
  }
}
