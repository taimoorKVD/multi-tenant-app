import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { EmailTemplate, EmailTemplateRecipient } from '../../master/mail/entities';
import { IsNull } from 'typeorm';
import {
  renderEmailLayout,
  renderEmailPlaceholderRows,
} from '../../mail/utils/email-layout.util';

function getUsersCreateTemplateHtml(loginUrl: string) {
  return renderEmailLayout({
    logoUrl: '{logo_url}',
    title: 'Welcome, {first_name}!',
    preheader: 'Your EuSocial account is ready. Sign in to get started.',
    introHtml:
      '<p style="margin:0;">Your account has been created successfully in EuSocial. Use the details below to sign in to your workspace.</p>',
    rowsHtml: renderEmailPlaceholderRows([
      { label: 'Full Name', value: '{full_name}' },
      { label: 'Email', value: '{email}' },
      { label: 'Password', value: '{password}' },
      { label: 'Tenant', value: '{tenant_slug}' },
      { label: 'Role', value: '{role_name}' },
    ]),
    stackedRows: true,
    cta: { label: 'Sign In to Your Workspace', url: loginUrl },
  });
}

function getUsersUpdateTemplateHtml(loginUrl: string) {
  return renderEmailLayout({
    logoUrl: '{logo_url}',
    title: 'Profile Updated',
    preheader: 'Your EuSocial account details were updated.',
    introHtml:
      '<p style="margin:0;">Hi {first_name}, your account details were updated. Use your credentials below to sign in to your workspace.</p>',
    rowsHtml: renderEmailPlaceholderRows([
      { label: 'Full Name', value: '{full_name}' },
      { label: 'Email', value: '{email}' },
      { label: 'Password', value: '{password}' },
      { label: 'Tenant', value: '{tenant_slug}' },
      { label: 'Role', value: '{role_name}' },
    ]),
    stackedRows: true,
    cta: { label: 'Sign In to Your Workspace', url: loginUrl },
  });
}

export class UserEmailTemplateSeeder implements ISeeder {
  name = 'UserEmailTemplateSeeder';

  async run() {
    const templateRepo = MasterDataSource.getRepository(EmailTemplate);
    const recipientRepo = MasterDataSource.getRepository(EmailTemplateRecipient);
    // Resolved at send-time to the tenant subdomain URL (e.g. https://folio3.eusocial.thebetawebsite.com/)
    const loginUrl = '{tenant_login_url}';

    const existingCreate = await templateRepo.findOne({
      where: { module: 'users', action: 'create', role: IsNull(), tenantId: IsNull() },
      order: { id: 'DESC' },
    });
    const existingUpdate = await templateRepo.findOne({
      where: { module: 'users', action: 'update', role: IsNull(), tenantId: IsNull() },
      order: { id: 'DESC' },
    });

    const createTemplate = templateRepo.create({
      ...(existingCreate || {}),
      name: 'Users :: Create Notification',
      module: 'users',
      action: 'create',
      role: null,
      to: '{email}',
      cc: null,
      bcc: null,
      subject: 'Welcome {first_name} to EuSocial',
      body: getUsersCreateTemplateHtml(loginUrl),
      status: 'active',
      version: existingCreate ? existingCreate.version + 1 : 1,
      priority: 10,
      tenantId: null,
      isOverride: false,
    });

    const updateTemplate = templateRepo.create({
      ...(existingUpdate || {}),
      name: 'Users :: Update Notification',
      module: 'users',
      action: 'update',
      role: null,
      to: '{email}',
      cc: null,
      bcc: null,
      subject: 'Your profile was updated, {first_name}',
      body: getUsersUpdateTemplateHtml(loginUrl),
      status: 'active',
      version: existingUpdate ? existingUpdate.version + 1 : 1,
      priority: 10,
      tenantId: null,
      isOverride: false,
    });

    const savedCreate = await templateRepo.save(createTemplate);
    const savedUpdate = await templateRepo.save(updateTemplate);

    await recipientRepo.delete({ templateId: savedCreate.id });
    await recipientRepo.delete({ templateId: savedUpdate.id });

    await recipientRepo.save([
      recipientRepo.create({
        templateId: savedCreate.id,
        channel: 'to',
        sourceType: 'placeholder',
        value: '{email}',
      }),
      recipientRepo.create({
        templateId: savedUpdate.id,
        channel: 'to',
        sourceType: 'placeholder',
        value: '{email}',
      }),
    ]);

    console.log('✅ Seeded/updated users/create and users/update email templates with branded HTML.');
  }
}
