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
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_FROM = 'billing@eusocial.test';
    delete process.env.BILLING_NOTIFY_EMAIL;
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close });
    fetchMock = jest.spyOn(global, 'fetch' as any).mockRejectedValue(new Error('logo unavailable'));
    service = new StripeBillingMailService(signupRepo as any);
  });

  afterEach(() => {
    fetchMock.mockRestore();
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

  it('keeps Stripe ids out of customer checkout email and includes them for ops', async () => {
    process.env.BILLING_NOTIFY_EMAIL = 'ops@eusocial.test';

    await service.notify('checkout.session.completed', {
      tenant: { name: 'Acme', subdomain: 'acme', status: 'trial', email: 'hello@acme.com' } as any,
      signup: { id: 'signup-123', email: 'hello@acme.com', status: 'provisioned' } as any,
      details: { Amount: '29.00 USD', Reference: 'signup-123' },
      internalDetails: {
        'Stripe event': 'checkout.session.completed',
        'Checkout session': 'cs_test_abc',
      },
    });

    expect(sendMail).toHaveBeenCalledTimes(2);

    const customerMail = sendMail.mock.calls.find((call) => call[0].to === 'hello@acme.com')?.[0];
    const opsMail = sendMail.mock.calls.find((call) => call[0].to === 'ops@eusocial.test')?.[0];

    expect(customerMail.subject).toBe('Payment confirmed for Acme');
    expect(customerMail.html).toContain('Payment confirmed');
    expect(customerMail.html).toContain('29.00 USD');
    expect(customerMail.html).not.toContain('signup-123');
    expect(customerMail.html).not.toContain('>Domain<');
    expect(customerMail.html).not.toContain('>Reference<');
    expect(customerMail.html).not.toContain('checkout.session.completed');
    expect(customerMail.html).not.toContain('cs_test_abc');

    expect(opsMail.subject).toBe('[Ops] Payment confirmed for Acme');
    expect(opsMail.html).toContain('checkout.session.completed');
    expect(opsMail.html).toContain('cs_test_abc');
    expect(opsMail.html).not.toContain('>Domain<');
    expect(opsMail.html).not.toContain('>Reference<');
  });

  it('embeds the logo as a CID attachment when the image can be fetched', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    } as any);

    await service.notify('checkout.session.completed', {
      tenant: { name: 'Acme', email: 'hello@acme.com' } as any,
      details: { Amount: '29.00 USD' },
    });

    const mail = sendMail.mock.calls[0][0];
    expect(mail.html).toContain('cid:eusocial-logo');
    expect(mail.attachments).toEqual([
      expect.objectContaining({
        filename: 'eusocial-logo.png',
        cid: 'eusocial-logo',
        contentType: 'image/png',
      }),
    ]);
  });

  it('skips unknown Stripe events', async () => {
    await service.notify('radar.early_fraud_warning.created', {
      tenant: { email: 'hello@acme.com' } as any,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
