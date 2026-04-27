jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
  createTestAccount: jest.fn(),
  getTestMessageUrl: jest.fn(),
}));

import * as nodemailer from 'nodemailer';
import { EmailDispatchService } from './email-dispatch.service';

describe('EmailDispatchService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('falls back to Ethereal in development when primary SMTP send fails', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      MAIL_ETHEREAL_FALLBACK: 'true',
    };

    const primaryTransport = {
      sendMail: jest.fn().mockRejectedValue(new Error('Invalid login')),
      close: jest.fn(),
    };

    const fallbackTransport = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'ethereal-message-id' }),
      close: jest.fn(),
    };

    (nodemailer.createTransport as jest.Mock)
      .mockReturnValueOnce(primaryTransport)
      .mockReturnValueOnce(fallbackTransport);
    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
      user: 'ethereal-user',
      pass: 'ethereal-pass',
      smtp: {
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
      },
    });
    (nodemailer.getTestMessageUrl as jest.Mock).mockReturnValue('https://ethereal.email/message/preview');

    const emailLogRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    const service = new EmailDispatchService(emailLogRepo as any);

    const result = await service.dispatch({
      logId: 12,
      tenantId: 'kingdomvision',
      templateId: 10,
      templateVersion: 1,
      module: 'users',
      action: 'create',
      idempotencyKey: 'idempotency-key',
      to: ['john@example.com'],
      cc: [],
      bcc: [],
      subject: 'Welcome',
      body: '<p>Hello John</p>',
      smtp: {
        provider: 'mailtrap',
        host: 'sandbox.smtp.mailtrap.io',
        port: 2525,
        secure: false,
        username: 'bad-user',
        password: 'bad-pass',
        fromEmail: 'no-reply@eusocial.com',
        fromName: 'EuSocial',
        replyTo: 'support@eusocial.com',
      },
    });

    expect(result).toEqual(expect.objectContaining({ messageId: 'ethereal-message-id' }));
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
    expect(nodemailer.createTestAccount).toHaveBeenCalledTimes(1);
    expect(emailLogRepo.update).toHaveBeenNthCalledWith(1, 12, {
      metadata: {
        provider_fallback: 'ethereal',
        preview_url: 'https://ethereal.email/message/preview',
        original_provider: 'mailtrap',
      },
    });
    expect(emailLogRepo.update).toHaveBeenNthCalledWith(2, 12, expect.objectContaining({
      status: 'sent',
      transportMessageId: 'ethereal-message-id',
    }));
    expect(primaryTransport.close).toHaveBeenCalledTimes(1);
    expect(fallbackTransport.close).toHaveBeenCalledTimes(1);
  });
});