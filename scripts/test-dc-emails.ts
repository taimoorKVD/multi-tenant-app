/**
 * One-off: seed DC email templates and send test emails via MailService (SMTP2GO).
 * Usage: npx ts-node -r tsconfig-paths/register scripts/test-dc-emails.ts
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { MasterDataSource } from '../src/database/datasource';
import { DataCollectionEmailTemplateSeeder } from '../src/database/seeders/014-data-collection-email-templates.seeder';

async function ensureSmtp2goEnv() {
  // Align MailService env resolution with password-reset SMTP_* credentials.
  process.env.MAIL_FORCE_ENV_SMTP = 'true';
  process.env.MAIL_PROVIDER = 'smtp2go';
  process.env.MAIL_HOST = process.env.SMTP_HOST || process.env.MAIL_HOST || 'mail-eu.smtp2go.com';
  process.env.MAIL_PORT = process.env.SMTP_PORT || process.env.MAIL_PORT || '587';
  process.env.MAIL_USER = process.env.SMTP_USER || process.env.MAIL_USER;
  process.env.MAIL_PASS = process.env.SMTP_PASS || process.env.MAIL_PASS;
  process.env.MAIL_SECURE = process.env.SMTP_SECURE || process.env.MAIL_SECURE || 'false';
  process.env.MAIL_FROM_EMAIL =
    process.env.EMAIL_FROM || process.env.MAIL_FROM_EMAIL || 'hello@eusocial.com';
  process.env.MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'EuSocial';
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('SMTP_USER/SMTP_PASS (or MAIL_USER/MAIL_PASS) required for SMTP2GO');
  }
}

async function main() {
  const recipients = ['omais.kv@gmail.com', 'syed.umarkingdomvision@gmail.com'];
  const stamp = Date.now();

  await ensureSmtp2goEnv();

  if (!MasterDataSource.isInitialized) {
    await MasterDataSource.initialize();
  }

  console.log('Seeding data-collection email templates...');
  await new DataCollectionEmailTemplateSeeder().run();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const mailService = app.get(MailService);
    const frontend = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');
    const logoUrl = `${frontend}/images/eusocial-logo.png`;
    const tenantSlug = process.env.TEST_TENANT_SLUG || 'folio3';
    const platformHost = (() => {
      const explicit = process.env.PLATFORM_DOMAIN?.trim();
      if (explicit) return explicit.replace(/^\./, '').replace(/\/+$/, '');
      try {
        return new URL(frontend).hostname.replace(/^(www|admin)\./, '');
      } catch {
        return 'eusocial.thebetawebsite.com';
      }
    })();
    const loginUrl = `https://${tenantSlug}.${platformHost}/`;
    const req = { tenantId: tenantSlug, tenantConnection: null };

    const results: Array<Record<string, unknown>> = [];

    for (const to of recipients) {
      const notify = await mailService.sendTemplateMail(req, {
        module: 'data-collection',
        action: 'submission-notify',
        to,
        data: {
          email: to,
          recipient_name: to.split('@')[0],
          template_name: 'Daily Produce Inventory (TEST)',
          submitter_name: 'Test Employee',
          submitted_at: new Date().toISOString(),
          assignment_id: '1001',
          submission_id: '2001',
          tenant_login_url: loginUrl,
          logo_url: logoUrl,
        },
        idempotencyKey: `dc-test:submission-notify:${to}:${stamp}`,
      });
      results.push({ flow: 'submission-notify', to, ...notify });
      console.log(`✓ submission-notify → ${to} (${notify.status}, logId=${notify.logId})`);

      const due = await mailService.sendTemplateMail(req, {
        module: 'data-collection',
        action: 'assignment-due',
        to,
        data: {
          email: to,
          recipient_name: to.split('@')[0],
          template_name: 'Walk-In Cooler Inspection (TEST)',
          due_at: new Date().toISOString(),
          assignment_status: 'pending',
          assignment_id: '1002',
          tenant_login_url: loginUrl,
          logo_url: logoUrl,
        },
        idempotencyKey: `dc-test:assignment-due:${to}:${stamp}`,
      });
      results.push({ flow: 'assignment-due', to, ...due });
      console.log(`✓ assignment-due → ${to} (${due.status}, logId=${due.logId})`);
    }

    console.log('\nDone. Summary:');
    console.table(
      results.map((r) => ({
        flow: r.flow,
        to: r.to,
        status: r.status,
        logId: r.logId,
      })),
    );
  } finally {
    await app.close();
    if (MasterDataSource.isInitialized) {
      await MasterDataSource.destroy();
    }
  }
}

main().catch((error) => {
  console.error('DC email test failed:', error);
  process.exit(1);
});
