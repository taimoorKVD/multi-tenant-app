import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { GlobalMailSetting } from '../../master/mail/entities';
import { encryptMailSecret } from '../../mail/utils/mail-crypto.util';

export class GlobalMailSettingSeeder implements ISeeder {
  name = 'GlobalMailSettingSeeder';

  async run() {
    const repo = MasterDataSource.getRepository(GlobalMailSetting);

    const exists = await repo.count();
    if (exists > 0) {
      console.log('⚠️  Global SMTP settings already exist. Skipping seeding.');
      return;
    }

    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY);
    const provider = hasSendGrid ? 'sendgrid' : 'mailtrap';

    const host = hasSendGrid
      ? (process.env.SENDGRID_SMTP_HOST || 'smtp.sendgrid.net')
      : (process.env.MAILTRAP_HOST || process.env.MAILTRAP_SMTP_HOST || 'sandbox.smtp.mailtrap.io');

    const port = Number(
      hasSendGrid
        ? (process.env.SENDGRID_SMTP_PORT || 587)
        : (process.env.MAILTRAP_PORT || 2525),
    );

    const username = hasSendGrid
      ? 'apikey'
      : (process.env.MAILTRAP_USER || process.env.MAILTRAP_USERNAME || 'mailtrap-user');

    const password = hasSendGrid
      ? process.env.SENDGRID_API_KEY || 'sendgrid-api-key'
      : (process.env.MAILTRAP_PASS || process.env.MAILTRAP_PASSWORD || 'mailtrap-password');

    const setting = repo.create({
      provider,
      host,
      port,
      secure: false,
      username,
      encryptedPassword: encryptMailSecret(password),
      fromEmail: (process.env.MAIL_FROM_EMAIL || 'no-reply@eusocial.com').toLowerCase(),
      fromName: process.env.MAIL_FROM_NAME || 'EuSocial',
      replyTo: (process.env.MAIL_REPLY_TO || 'support@eusocial.com').toLowerCase(),
      isActive: true,
    });

    await repo.save(setting);
    console.log(`✅ Global SMTP seeded with provider "${provider}".`);
  }
}