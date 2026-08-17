import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { User } from '../../users/entities';
import { DynamicModule, EntityDynamicData } from '../../form-builder/entities';

export type DcMailRecipient = {
  id: number;
  email: string | null;
  name: string | null;
};

type SmtpConfig = {
  host: string | null;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromEmail: string;
  fromName?: string;
  replyTo?: string;
};

/**
 * Data Collection emails use the same direct SMTP pattern as Tenant Credentials
 * (SMTP_HOST / SMTP_USER / SMTP_PASS / EMAIL_FROM) — no DB mail-settings decrypt.
 */
@Injectable()
export class WorkflowActionsService {
  private readonly logger = new Logger(WorkflowActionsService.name);

  private getEnvValue(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) return value;
    }
    return undefined;
  }

  private getFrontendBaseUrl(): string {
    const configured = this.getEnvValue('FRONTEND_URL');
    if (configured) return configured.replace(/\/+$/, '');
    return 'http://localhost:4200';
  }

  private getLogoUrl(): string {
    return `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
  }

  private getTenantLoginUrl(): string {
    return `${this.getFrontendBaseUrl()}/tenant/login`;
  }

  /** Display as `06-Aug-2026 10:02` (local server time). */
  private formatDateTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  }

  /** Same SMTP resolution as TenantsService / AuthService (credentials & forgot-password). */
  private resolveSmtpConfig(): SmtpConfig | null {
    const explicitFrom = this.getEnvValue('SMTP_FROM', 'EMAIL_FROM', 'MAIL_FROM_EMAIL');
    const smtpUsername = this.getEnvValue('SMTP_USER', 'MAIL_USER');
    const fromEmail =
      explicitFrom || (smtpUsername && smtpUsername.includes('@') ? smtpUsername : null);

    if (!fromEmail) return null;

    const blockedDomains = ['yourdomain.com', 'example.com'];
    const fromDomain = fromEmail.split('@')[1]?.toLowerCase() || '';
    if (blockedDomains.includes(fromDomain)) return null;

    return {
      host: this.getEnvValue('SMTP_HOST', 'MAIL_HOST') || null,
      port: Number(this.getEnvValue('SMTP_PORT', 'MAIL_PORT') || 587),
      secure: this.getEnvValue('SMTP_SECURE', 'MAIL_SECURE') === 'true',
      username: smtpUsername,
      password: this.getEnvValue('SMTP_PASS', 'MAIL_PASS'),
      fromEmail,
      fromName: this.getEnvValue('MAIL_FROM_NAME'),
      replyTo: this.getEnvValue('MAIL_REPLY_TO'),
    };
  }

  private wrapHtml(title: string, intro: string, rowsHtml: string, ctaLabel: string): string {
    const logoUrl = this.getLogoUrl();
    const loginUrl = this.getTenantLoginUrl();
    return `
  <div style="margin:0;padding:0;background:#f5f8fb;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5eaf1;">
            <tr>
              <td style="padding:24px 28px;background:#101820;">
                <img src="${logoUrl}" alt="EuSocial" style="height:50px;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 22px;color:#1f2d3d;">
                <h2 style="margin:0 0 10px;font-size:22px;line-height:30px;color:#0b2948;">${title}</h2>
                <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334e68;">${intro}</p>
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

  private async sendDirectSmtpMail(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<{ status: string; detail?: string }> {
    try {
      const smtp = this.resolveSmtpConfig();
      if (!smtp?.host || !smtp.fromEmail) {
        return {
          status: 'failed',
          detail:
            'SMTP is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS and EMAIL_FROM (same as tenant credentials).',
        };
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.username
          ? { user: smtp.username, pass: smtp.password || undefined }
          : undefined,
      });

      const info = await transporter.sendMail({
        from: smtp.fromName ? `"${smtp.fromName}" <${smtp.fromEmail}>` : smtp.fromEmail,
        to: options.to,
        replyTo: smtp.replyTo || undefined,
        subject: options.subject,
        html: options.html,
      });

      this.logger.log(`DC email sent to ${options.to} messageId=${info.messageId}`);
      return { status: 'sent', detail: `messageId=${info.messageId}` };
    } catch (error) {
      this.logger.error(`DC email send failed: ${(error as Error).message}`, error);
      return { status: 'failed', detail: (error as Error).message };
    }
  }

  async runAfterSubmit(
    req: any,
    context: {
      templateId: number;
      templateName: string;
      assignmentId: number;
      submissionId: number;
      schema: Record<string, any>;
      submittedBy: number | null;
    },
  ): Promise<{ actions: Array<{ type: string; status: string; detail?: string }> }> {
    const schema = context.schema || {};
    const configured: Array<{ type: string; [key: string]: any }> = Array.isArray(
      schema.workflow?.actions,
    )
      ? schema.workflow.actions
      : [{ type: 'notify', targets: 'report' }];

    const results: Array<{ type: string; status: string; detail?: string }> = [];
    const submitter = await this.resolveUser(req, context.submittedBy);
    const submittedAt = new Date().toISOString();
    const templateName = context.templateName || `Template #${context.templateId}`;

    for (const action of configured) {
      if (action.type === 'notify') {
        const recipients = await this.resolveReportRecipients(req, schema.report || {});
        const withEmail = recipients.filter((r) => !!r.email);

        if (!withEmail.length) {
          results.push({
            type: 'notify',
            status: 'skipped',
            detail: 'No report recipients with email',
          });
          continue;
        }

        let sent = 0;
        let failed = 0;
        for (const recipient of withEmail) {
          const result = await this.sendDirectSmtpMail({
            to: recipient.email!,
            subject: `New submission: ${templateName}`,
            html: this.wrapHtml(
              'New Data Collection Submission',
              `Hi ${recipient.name || recipient.email}, a form was submitted and you were listed as a report recipient.`,
              `
                <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> ${templateName}</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submitted by:</strong> ${submitter?.name || submitter?.email || 'Unknown'}</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submitted at:</strong> ${submittedAt}</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> ${context.assignmentId}</td></tr>
                <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Submission ID:</strong> ${context.submissionId}</td></tr>
              `,
              'Open Workspace',
            ),
          });
          if (result.status === 'failed') failed += 1;
          else sent += 1;
        }

        results.push({
          type: 'notify',
          status: failed && !sent ? 'failed' : failed ? 'partial' : 'sent',
          detail: `Recipients emailed: ${sent}, failed: ${failed}`,
        });
        continue;
      }

      if (action.type === 'create_task') {
        this.logger.log(
          `create_task stub: assignment=${context.assignmentId} submission=${context.submissionId}`,
        );
        results.push({ type: 'create_task', status: 'stubbed' });
        continue;
      }

      results.push({ type: action.type || 'unknown', status: 'skipped' });
    }

    return { actions: results };
  }

  async sendAssignmentDueReminder(
    req: any,
    context: {
      assignmentId: number;
      templateName: string;
      dueAt: Date;
      status: string;
      recipient: DcMailRecipient;
    },
  ): Promise<{ status: string; detail?: string }> {
    if (!context.recipient.email) {
      return { status: 'skipped', detail: 'Assignee has no email' };
    }

    return this.sendDirectSmtpMail({
      to: context.recipient.email,
      subject: `Reminder: ${context.templateName} is due ${this.formatDateTime(context.dueAt)}`,
      html: this.wrapHtml(
        'Assignment Due Reminder',
        `Hi ${context.recipient.name || context.recipient.email}, you have a data collection assignment that is due.`,
        `
          <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> ${context.templateName}</td></tr>
          <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Due:</strong> ${this.formatDateTime(context.dueAt)}</td></tr>
          <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Status:</strong> ${context.status}</td></tr>
          <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> ${context.assignmentId}</td></tr>
        `,
        'Complete Assignment',
      ),
    });
  }

  async notifyAssigneesOnPublish(
    req: any,
    context: {
      templateId: number;
      templateName: string;
      assignments: Array<{ id: number; assigneeUserId: number | null; dueAt: Date; status: string }>;
    },
  ): Promise<{ sent: number; failed: number; skipped: number }> {
    const byUser = new Map<number, { id: number; dueAt: Date; status: string }>();
    for (const assignment of context.assignments) {
      if (assignment.assigneeUserId == null) continue;
      const existing = byUser.get(assignment.assigneeUserId);
      if (!existing || assignment.dueAt < existing.dueAt) {
        byUser.set(assignment.assigneeUserId, {
          id: assignment.id,
          dueAt: assignment.dueAt,
          status: assignment.status,
        });
      }
    }

    if (!byUser.size) {
      return { sent: 0, failed: 0, skipped: context.assignments.length };
    }

    const recipients = await this.resolveUsersByIds(req, [...byUser.keys()]);
    const recipientById = new Map(recipients.map((r) => [r.id, r]));
    const templateName = context.templateName || `Template #${context.templateId}`;

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const [userId, assignment] of byUser.entries()) {
      const recipient = recipientById.get(userId);
      if (!recipient?.email) {
        skipped += 1;
        this.logger.warn(`Publish notify skipped for user ${userId}: no email on users record`);
        continue;
      }

      const assignmentCount = context.assignments.filter((a) => a.assigneeUserId === userId).length;
      const result = await this.sendDirectSmtpMail({
        to: recipient.email,
        subject: `New assignment: ${templateName}`,
        html: this.wrapHtml(
          'You Have a New Assignment',
          `Hi ${recipient.name || recipient.email}, a data collection form was published and assigned to you.`,
          `
            <tr><td style="padding:14px 16px;font-size:14px;color:#1f2d3d;"><strong>Form:</strong> ${templateName}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>First due:</strong> ${this.formatDateTime(assignment.dueAt)}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Occurrences:</strong> ${assignmentCount}</td></tr>
            <tr><td style="padding:0 16px 14px;font-size:14px;color:#1f2d3d;"><strong>Assignment ID:</strong> ${assignment.id}</td></tr>
          `,
          "Open Today's Work",
        ),
      });

      if (result.status === 'failed') failed += 1;
      else sent += 1;
    }

    return { sent, failed, skipped };
  }

  async resolveReportRecipients(
    req: any,
    report: { users?: number[]; jobPosition?: number[] },
  ): Promise<DcMailRecipient[]> {
    const userIds = new Set<number>((report.users || []).map(Number).filter(Number.isFinite));

    for (const jpId of report.jobPosition || []) {
      const resolved = await this.resolveUsersByJobPosition(req, Number(jpId));
      resolved.forEach((id) => userIds.add(id));
    }

    return this.resolveUsersByIds(req, [...userIds]);
  }

  async resolveUsersByIds(req: any, userIds: number[]): Promise<DcMailRecipient[]> {
    if (!userIds.length) return [];
    const userRepo = req.tenantConnection.getRepository(User);
    return userRepo.find({
      where: { id: In(userIds) },
      select: ['id', 'email', 'name'],
    });
  }

  private async resolveUser(req: any, userId: number | null): Promise<DcMailRecipient | null> {
    if (userId == null) return null;
    const users = await this.resolveUsersByIds(req, [userId]);
    return users[0] || null;
  }

  private async resolveUsersByJobPosition(req: any, jobPositionId: number): Promise<number[]> {
    try {
      const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
      const dynamicRepo = req.tenantConnection.getRepository(EntityDynamicData);
      const usersModule = await moduleRepo.findOne({ where: { slug: 'users' } });
      if (!usersModule) return [];

      const rows: EntityDynamicData[] = await dynamicRepo.find({
        where: { moduleId: usersModule.id },
      });

      return rows
        .filter((row) => {
          const values = Object.values(row.data || {});
          return values.some(
            (v) =>
              v == jobPositionId ||
              (v && typeof v === 'object' && (v as any).id == jobPositionId),
          );
        })
        .map((row) => row.entityId);
    } catch {
      return [];
    }
  }
}
