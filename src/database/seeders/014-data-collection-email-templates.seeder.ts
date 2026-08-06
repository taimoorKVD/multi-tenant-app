import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { EmailTemplate, EmailTemplateRecipient } from '../../master/mail/entities';
import { IsNull } from 'typeorm';

function wrapHtml(title: string, intro: string, rowsHtml: string, ctaLabel: string, loginUrl: string) {
  return `
  <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
            <tr>
              <td style="padding:24px 28px;background:#101820;">
                <img src="{logo_url}" alt="EuSocial" style="height:50px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 22px;color:#1f2d3d;">
                <h2 style="margin:0 0 10px;font-size:22px;line-height:30px;color:#0b2948;">${title}</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">
                  ${intro}
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border:1px solid #e8edf3;border-radius:10px;">
                  ${rowsHtml}
                </table>
                <a href="${loginUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#ff9900;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">${ctaLabel}</a>
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

export class DataCollectionEmailTemplateSeeder implements ISeeder {
  name = 'DataCollectionEmailTemplateSeeder';

  async run() {
    const templateRepo = MasterDataSource.getRepository(EmailTemplate);
    const recipientRepo = MasterDataSource.getRepository(EmailTemplateRecipient);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');
    const loginUrl = `${frontendUrl}/tenant/login`;

    const definitions = [
      {
        module: 'data-collection',
        action: 'submission-notify',
        name: 'Data Collection :: Submission Notify',
        subject: 'New submission: {template_name}',
        body: wrapHtml(
          'New Data Collection Submission',
          'Hi {recipient_name}, a form was submitted and you were listed as a report recipient.',
          `
            <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> {template_name}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submitted by:</strong> {submitter_name}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submitted at:</strong> {submitted_at}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> {assignment_id}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submission ID:</strong> {submission_id}</td></tr>
          `,
          'Open Workspace',
          loginUrl,
        ),
      },
      {
        module: 'data-collection',
        action: 'assignment-due',
        name: 'Data Collection :: Assignment Due Reminder',
        subject: 'Reminder: {template_name} is due {due_at}',
        body: wrapHtml(
          'Assignment Due Reminder',
          'Hi {recipient_name}, you have a data collection assignment that is due.',
          `
            <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> {template_name}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Due:</strong> {due_at}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Status:</strong> {assignment_status}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> {assignment_id}</td></tr>
          `,
          'Complete Assignment',
          loginUrl,
        ),
      },
      {
        module: 'data-collection',
        action: 'assignment-assigned',
        name: 'Data Collection :: Assignment Assigned',
        subject: 'New assignment: {template_name}',
        body: wrapHtml(
          'You Have a New Assignment',
          'Hi {recipient_name}, a data collection form was published and assigned to you.',
          `
            <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> {template_name}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>First due:</strong> {due_at}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Occurrences:</strong> {assignment_count}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> {assignment_id}</td></tr>
          `,
          'Open Today\'s Work',
          loginUrl,
        ),
      },
    ];

    for (const def of definitions) {
      const existing = await templateRepo.findOne({
        where: {
          module: def.module,
          action: def.action,
          role: IsNull(),
          tenantId: IsNull(),
        },
        order: { id: 'DESC' },
      });

      const template = templateRepo.create({
        ...(existing || {}),
        name: def.name,
        module: def.module,
        action: def.action,
        role: null,
        to: '{email}',
        cc: null,
        bcc: null,
        subject: def.subject,
        body: def.body,
        status: 'active',
        version: existing ? existing.version + 1 : 1,
        priority: 10,
        tenantId: null,
        isOverride: false,
      });

      const saved = await templateRepo.save(template);
      await recipientRepo.delete({ templateId: saved.id });
      await recipientRepo.save(
        recipientRepo.create({
          templateId: saved.id,
          channel: 'to',
          sourceType: 'placeholder',
          value: '{email}',
        }),
      );

      console.log(
        `✅ Email template ensured: ${def.module}/${def.action} (v${saved.version})`,
      );
    }
  }
}
