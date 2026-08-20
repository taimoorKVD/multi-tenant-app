import { StripeBillingMailService } from './stripe-billing-mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import * as nodemailer from 'nodemailer';

describe('StripeBillingMailService', () => {
  const signupRepo = { findOne: jest.fn() };
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'm1' });
  const close = jest.fn();

  let service: StripeBillingMailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_FROM = 'billing@eusocial.test';
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close });
    service = new StripeBillingMailService(signupRepo as any);
  });

  it('sends a cancellation-styled email when a subscription is deleted', async () => {
    await service.notify('customer.subscription.deleted', {
      tenant: { id: 12, name: 'Acme', subdomain: 'acme', status: 'suspended', email: 'hello@acme.com' } as any,
      subscription: { status: 'cancelled', billingCycle: 'monthly', plan: { name: 'Basic' } } as any,
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hello@acme.com',
        subject: 'Subscription cancelled for Acme',
      }),
    );
    const html = sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('Subscription cancelled');
    expect(html).toContain('suspended');
  });

  it('sends a payment-failed email with invoice context', async () => {
    await service.notify('invoice.payment_failed', {
      tenant: { name: 'Acme', email: 'hello@acme.com' } as any,
      invoice: {
        invoiceNumber: 'INV-2026-0001',
        amountCents: 25000,
        currency: 'USD',
        status: 'pending',
        hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      } as any,
    });

    expect(sendMail.mock.calls[0][0].subject).toBe('Payment failed for Acme');
    expect(sendMail.mock.calls[0][0].html).toContain('Payment failed');
    expect(sendMail.mock.calls[0][0].html).toContain('INV-2026-0001');
    expect(sendMail.mock.calls[0][0].html).toContain('View invoice');
  });

  it('skips unknown Stripe events', async () => {
    await service.notify('radar.early_fraud_warning.created', {
      tenant: { email: 'hello@acme.com' } as any,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
