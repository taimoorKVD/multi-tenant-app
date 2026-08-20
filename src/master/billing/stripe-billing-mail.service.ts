import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities';
import { Invoice, Subscription, WebsiteSignup } from './entities';

export type StripeMailContext = {
  tenant?: Tenant | null;
  subscription?: Subscription | null;
  invoice?: Invoice | null;
  signup?: WebsiteSignup | null;
  details?: Record<string, string | null | undefined>;
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

    const recipients = this.recipients(context);
    if (!recipients.length) {
      this.logger.warn(`No billing email recipient for Stripe event ${eventType}`);
      return;
    }

    const smtp = this.resolveSmtpConfig();
    if (!smtp?.host || !smtp.fromEmail) {
      this.logger.warn('SMTP is not configured; Stripe billing email was skipped');
      return;
    }

    const html = this.renderHtml(template, context);
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.username
        ? { user: smtp.username, pass: smtp.password || undefined }
        : undefined,
    });

    try {
      for (const to of recipients) {
        await transporter.sendMail({
          from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
          to,
          replyTo: smtp.replyTo || undefined,
          subject: template.subject,
          html,
        });
        this.logger.log(`Stripe billing email (${eventType}) sent to ${to}`);
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

  private recipients(context: StripeMailContext): string[] {
    const list = [
      context.tenant?.email,
      context.signup?.email,
      process.env.BILLING_NOTIFY_EMAIL,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    return [...new Set(list)];
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
        intro: `Billing details for <strong>${this.escape(tenantName)}</strong> were updated in Stripe. Review the summary below.`,
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
        intro: `The Stripe subscription for <strong>${this.escape(tenantName)}</strong> was cancelled or deleted. The workspace has been suspended until a new plan is started.`,
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
        intro: `Stripe needs an extra step (for example 3D Secure) to complete payment for <strong>${this.escape(tenantName)}</strong>. Open the invoice link below to finish.`,
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
        subject: `Checkout payment confirmed for ${tenantName}`,
        heading: 'Checkout payment confirmed',
        intro: `Stripe Checkout completed successfully for <strong>${this.escape(tenantName)}</strong>. Your workspace will be provisioned if it is not already ready.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'checkout.session.async_payment_succeeded': {
        subject: `Checkout payment confirmed for ${tenantName}`,
        heading: 'Delayed payment succeeded',
        intro: `A delayed Checkout payment succeeded for <strong>${this.escape(tenantName)}</strong>. Provisioning will continue if needed.`,
        accent: '#1b7f4e',
        badge: 'Paid',
        badgeBg: '#e8f5ee',
        badgeColor: '#1b7f4e',
      },
      'checkout.session.expired': {
        subject: `Checkout expired for ${tenantName}`,
        heading: 'Checkout expired',
        intro: `The Stripe Checkout session for <strong>${this.escape(tenantName)}</strong> expired before payment. Start checkout again to complete signup.`,
        accent: '#d97706',
        badge: 'Expired',
        badgeBg: '#fef3cd',
        badgeColor: '#856404',
      },
      'checkout.session.async_payment_failed': {
        subject: `Checkout payment failed for ${tenantName}`,
        heading: 'Checkout payment failed',
        intro: `A delayed Checkout payment failed for <strong>${this.escape(tenantName)}</strong>. No workspace was activated for this attempt.`,
        accent: '#c0392b',
        badge: 'Failed',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
      'customer.deleted': {
        subject: `Billing customer removed for ${tenantName}`,
        heading: 'Billing customer removed',
        intro: `The Stripe customer record for <strong>${this.escape(tenantName)}</strong> was deleted. The workspace has been suspended.`,
        accent: '#c0392b',
        badge: 'Suspended',
        badgeBg: '#fdecea',
        badgeColor: '#c0392b',
      },
    };

    return templates[eventType] || null;
  }

  private renderHtml(template: MailTemplate, context: StripeMailContext): string {
    const rows = this.detailRows(context);
    const rowHtml = rows
      .map(
        ([label, value]) => `
          <tr style="border-bottom:1px solid #e8edf3;">
            <td style="padding:14px 16px;font-size:13px;color:#7b8794;background:#f5f8fb;width:40%;"><strong>${this.escape(label)}</strong></td>
            <td style="padding:14px 16px;font-size:14px;color:#1f2d3d;">${value}</td>
          </tr>`,
      )
      .join('');

    return `
      <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
                <tr>
                  <td style="padding:22px 28px;background:#101820;color:#ffffff;">
                    <div style="font-size:18px;font-weight:bold;letter-spacing:0.3px;">EuSocial Billing</div>
                  </td>
                </tr>
                <tr>
                  <td style="height:6px;background:${template.accent};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:30px 28px 22px;color:#1f2d3d;">
                    <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${template.badgeBg};color:${template.badgeColor};font-size:12px;font-weight:bold;margin-bottom:12px;">${this.escape(template.badge)}</span>
                    <h2 style="margin:12px 0 10px;font-size:24px;line-height:30px;color:#0b2948;">${this.escape(template.heading)}</h2>
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">${template.intro}</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;border:1px solid #e8edf3;border-radius:10px;background:#f9fafb;overflow:hidden;">
                      ${rowHtml}
                    </table>
                    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#7b8794;">
                      This message was sent because a Stripe billing event was received by EuSocial. © ${new Date().getFullYear()} EuSocial.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private detailRows(context: StripeMailContext): Array<[string, string]> {
    const invoiceMoney = context.invoice
      ? `${(Number(context.invoice.amountCents || 0) / 100).toFixed(2)} ${(context.invoice.currency || '').toUpperCase()}`
      : null;
    const invoiceLink = context.invoice?.hostedInvoiceUrl
      ? `<a href="${this.escape(context.invoice.hostedInvoiceUrl)}" style="color:#0b73e6;text-decoration:none;">View invoice</a>`
      : null;

    const rows: Array<[string, string | null | undefined]> = [
      ['Workspace', context.tenant?.name],
      ['Domain', context.tenant?.subdomain],
      ['Workspace status', context.tenant?.status],
      ['Plan', context.subscription?.plan?.name],
      ['Subscription status', context.subscription?.status],
      ['Billing cycle', context.subscription?.billingCycle],
      ['Invoice number', context.invoice?.invoiceNumber],
      ['Amount', invoiceMoney],
      ['Invoice status', context.invoice?.status],
      ['Invoice', invoiceLink],
      ['Signup email', context.signup?.email],
      ['Signup status', context.signup?.status],
    ];

    Object.entries(context.details || {}).forEach(([label, value]) => {
      rows.push([label, value]);
    });

    return rows
      .filter(([, value]) => Boolean(value))
      .map(([label, value]) => [label, String(value)]) as Array<[string, string]>;
  }

  private escape(value: string) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
