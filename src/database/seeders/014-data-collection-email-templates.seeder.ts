import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { EmailTemplate, EmailTemplateRecipient } from '../../master/mail/entities';
import { IsNull } from 'typeorm';
import {
  renderEmailLayout,
  renderEmailPlaceholderRows,
} from '../../mail/utils/email-layout.util';

function wrapHtml(
  title: string,
  intro: string,
  rows: Array<{ label: string; value: string }>,
  ctaLabel: string,
  loginUrl: string,
) {
  return renderEmailLayout({
    logoUrl: '{logo_url}',
    title,
    preheader: title,
    introHtml: `<p style="margin:0;">${intro}</p>`,
    rowsHtml: renderEmailPlaceholderRows(rows),
    stackedRows: true,
    cta: { label: ctaLabel, url: loginUrl },
  });
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
          [
            { label: 'Form', value: '{template_name}' },
            { label: 'Submitted by', value: '{submitter_name}' },
            { label: 'Submitted at', value: '{submitted_at}' },
            { label: 'Assignment ID', value: '{assignment_id}' },
            { label: 'Submission ID', value: '{submission_id}' },
          ],
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
          [
            { label: 'Form', value: '{template_name}' },
            { label: 'Due', value: '{due_at}' },
            { label: 'Status', value: '{assignment_status}' },
            { label: 'Assignment ID', value: '{assignment_id}' },
          ],
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
          [
            { label: 'Form', value: '{template_name}' },
            { label: 'First due', value: '{due_at}' },
            { label: 'Occurrences', value: '{assignment_count}' },
            { label: 'Assignment ID', value: '{assignment_id}' },
          ],
          "Open Today's Work",
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
