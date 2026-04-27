import { MailService } from './mail.service';

describe('MailService', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('uses Mailtrap sandbox env variables without requiring generic MAIL_HOST', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      MAIL_PROVIDER: 'mailtrap',
      MAIL_FROM_EMAIL: 'no-reply@eusocial.com',
      MAIL_FROM_NAME: 'EuSocial',
      MAIL_REPLY_TO: 'support@eusocial.com',
      MAILTRAP_HOST: 'sandbox.smtp.mailtrap.io',
      MAILTRAP_PORT: '2525',
      MAILTRAP_USERNAME: 'sandbox-user',
      MAILTRAP_PASSWORD: 'sandbox-pass',
      MAIL_HOST: '',
      MAIL_USER: '',
      MAIL_PASS: '',
    };

    const templateService = {
      getEffectiveTemplate: jest.fn().mockResolvedValue({
        tenantConnection: null,
        template: {
          id: 10,
          version: 1,
          name: 'Users :: Create Notification',
          module: 'users',
          action: 'create',
          to: '{email}',
          cc: null,
          bcc: null,
          subject: 'Welcome {first_name}',
          body: '<p>Hello {first_name}</p>',
          recipients: [],
        },
      }),
    };

    const emailDispatchService = {
      dispatch: jest.fn().mockResolvedValue({ messageId: 'mailtrap-test-message' }),
    };

    const emailLogRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({ id: 77, ...value })),
    };

    const globalMailSettingRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const baseResolver = {
      supports: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue({}),
    };

    const userResolver = {
      supports: jest.fn().mockImplementation((module: string) => module === 'users'),
      resolve: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
    };

    const orderResolver = {
      supports: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue({}),
    };

    const service = new MailService(
      templateService as any,
      {} as any,
      emailDispatchService as any,
      emailLogRepo as any,
      globalMailSettingRepo as any,
      baseResolver as any,
      userResolver as any,
      orderResolver as any,
    );

    const result = await service.sendTemplateMail({}, {
      module: 'users',
      action: 'create',
      to: 'john@example.com',
      data: {
        first_name: 'John',
        email: 'john@example.com',
      },
    });

    expect(result).toEqual({
      success: true,
      status: 'sent',
      logId: 77,
      idempotencyKey: expect.any(String),
    });

    expect(emailDispatchService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        smtp: expect.objectContaining({
          provider: 'mailtrap',
          host: 'sandbox.smtp.mailtrap.io',
          port: 2525,
          username: 'sandbox-user',
          password: 'sandbox-pass',
          fromEmail: 'no-reply@eusocial.com',
          fromName: 'EuSocial',
          replyTo: 'support@eusocial.com',
        }),
      }),
      1,
      1,
    );
  });

  it('prefers env SMTP over stored global settings in development', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      MAIL_PROVIDER: 'mailtrap',
      MAIL_FROM_EMAIL: 'no-reply@eusocial.com',
      MAILTRAP_HOST: 'sandbox.smtp.mailtrap.io',
      MAILTRAP_PORT: '2525',
      MAILTRAP_USERNAME: 'env-user',
      MAILTRAP_PASSWORD: 'env-pass',
    };

    const templateService = {
      getEffectiveTemplate: jest.fn().mockResolvedValue({
        tenantConnection: null,
        template: {
          id: 10,
          version: 1,
          name: 'Users :: Create Notification',
          module: 'users',
          action: 'create',
          to: '{email}',
          cc: null,
          bcc: null,
          subject: 'Welcome {first_name}',
          body: '<p>Hello {first_name}</p>',
          recipients: [],
        },
      }),
    };

    const emailDispatchService = {
      dispatch: jest.fn().mockResolvedValue({ messageId: 'mailtrap-test-message' }),
    };

    const emailLogRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({ id: 78, ...value })),
    };

    const globalMailSettingRepo = {
      findOne: jest.fn().mockResolvedValue({
        provider: 'mailtrap',
        host: 'old.smtp.host',
        port: 587,
        secure: false,
        username: 'db-user',
        encryptedPassword: null,
        fromEmail: 'db@example.com',
        fromName: 'DB Mailer',
        replyTo: 'db-reply@example.com',
      }),
    };

    const baseResolver = {
      supports: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue({}),
    };

    const userResolver = {
      supports: jest.fn().mockImplementation((module: string) => module === 'users'),
      resolve: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data),
    };

    const orderResolver = {
      supports: jest.fn().mockReturnValue(false),
      resolve: jest.fn().mockResolvedValue({}),
    };

    const service = new MailService(
      templateService as any,
      {} as any,
      emailDispatchService as any,
      emailLogRepo as any,
      globalMailSettingRepo as any,
      baseResolver as any,
      userResolver as any,
      orderResolver as any,
    );

    await service.sendTemplateMail({}, {
      module: 'users',
      action: 'create',
      to: 'john@example.com',
      data: {
        first_name: 'John',
        email: 'john@example.com',
      },
    });

    expect(emailDispatchService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        smtp: expect.objectContaining({
          host: 'sandbox.smtp.mailtrap.io',
          port: 2525,
          username: 'env-user',
          password: 'env-pass',
          fromEmail: 'no-reply@eusocial.com',
        }),
      }),
      1,
      1,
    );
  });
});