import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { EmailTemplate, EmailTemplateRecipient } from '../../master/mail/entities';
import { IsNull } from 'typeorm';

function getUsersCreateTemplateHtml(loginUrl: string) {
  return `
  <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
            <tr>
              <td style="padding:24px 28px;background:#0b2948;">
                <img src="{logo_url}" alt="EuSocial" style="height:44px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 22px;color:#1f2d3d;">
                <h2 style="margin:0 0 10px;font-size:24px;line-height:30px;color:#0b2948;">Welcome, {first_name}!</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">
                  Your account has been created successfully in EuSocial.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border:1px solid #e8edf3;border-radius:10px;">
                  <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Full Name:</strong> {full_name}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Email:</strong> {email}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Password:</strong> {password}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Tenant:</strong> {tenant_slug}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Role:</strong> {role_name}</td></tr>
                </table>
                <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334e68;">
                  Use your email and password above to sign in to your workspace.
                </p>
                <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#0b2948;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Sign In to Your Workspace</a>
                <p style="margin:0;font-size:13px;line-height:20px;color:#7b8794;">
                  © 2026 EuSocial. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function getUsersUpdateTemplateHtml(loginUrl: string) {
  return `
  <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
            <tr>
              <td style="padding:24px 28px;background:#123c69;">
                <img src="{logo_url}" alt="EuSocial" style="height:44px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 22px;color:#1f2d3d;">
                <h2 style="margin:0 0 10px;font-size:22px;line-height:30px;color:#123c69;">Profile Updated</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">
                  Hi {first_name}, your account details were updated.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border:1px solid #e8edf3;border-radius:10px;">
                  <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Full Name:</strong> {full_name}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Email:</strong> {email}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Password:</strong> {password}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Tenant:</strong> {tenant_slug}</td></tr>
                  <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Role:</strong> {role_name}</td></tr>
                </table>
                <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#334e68;">
                  Use your updated credentials to sign in to your workspace.
                </p>
                <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#123c69;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Sign In to Your Workspace</a>
                <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#7b8794;">
                  © 2026 EuSocial. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

export class UserEmailTemplateSeeder implements ISeeder {
  name = 'UserEmailTemplateSeeder';

  async run() {
    const templateRepo = MasterDataSource.getRepository(EmailTemplate);
    const recipientRepo = MasterDataSource.getRepository(EmailTemplateRecipient);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');
    const loginUrl = `${frontendUrl}/tenant/login`;

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