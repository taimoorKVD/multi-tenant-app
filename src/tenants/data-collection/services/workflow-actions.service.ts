import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { MailService } from '../../../mail/mail.service';
import { User } from '../../users/entities';
import { DynamicModule, EntityDynamicData } from '../../form-builder/entities';

export type DcMailRecipient = {
  id: number;
  email: string | null;
  name: string | null;
};

/**
 * Sends real emails for Data Collection via MailService templates:
 * - data-collection / submission-notify
 * - data-collection / assignment-due
 */
@Injectable()
export class WorkflowActionsService {
  private readonly logger = new Logger(WorkflowActionsService.name);

  constructor(private readonly mailService: MailService) {}

  private getFrontendBaseUrl(): string {
    return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');
  }

  private getLogoUrl(): string {
    return `${this.getFrontendBaseUrl()}/assets/eusocial-logo.png`;
  }

  private getTenantLoginUrl(): string {
    return `${this.getFrontendBaseUrl()}/tenant/login`;
  }

  private async sendMailSafe(
    req: any,
    payload: Parameters<MailService['sendTemplateMail']>[1],
  ): Promise<{ status: string; detail?: string }> {
    try {
      const isDevelopment = (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
      if (isDevelopment) {
        const result = await this.mailService.sendTemplateMail(req, payload);
        return { status: result.status, detail: `logId=${result.logId}` };
      }

      void this.mailService.sendTemplateMail(req, payload).catch((error) => {
        this.logger.error(`Failed to queue DC email (${payload.module}/${payload.action})`, error);
      });
      return { status: 'queued' };
    } catch (error) {
      this.logger.error(
        `DC email send failed (${payload.module}/${payload.action}): ${(error as Error).message}`,
      );
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
    const configured: Array<{ type: string; [key: string]: any }> = Array.isArray(schema.workflow?.actions)
      ? schema.workflow.actions
      : [{ type: 'notify', targets: 'report' }];

    const results: Array<{ type: string; status: string; detail?: string }> = [];
    const submitter = await this.resolveUser(req, context.submittedBy);
    const submittedAt = new Date().toISOString();

    for (const action of configured) {
      if (action.type === 'notify') {
        const recipients = await this.resolveReportRecipients(req, schema.report || {});
        const withEmail = recipients.filter((r) => !!r.email);

        if (!withEmail.length) {
          results.push({ type: 'notify', status: 'skipped', detail: 'No report recipients with email' });
          continue;
        }

        let sent = 0;
        let failed = 0;
        for (const recipient of withEmail) {
          const result = await this.sendMailSafe(req, {
            module: 'data-collection',
            action: 'submission-notify',
            tenantId: req?.tenantId || null,
            to: recipient.email!,
            data: {
              email: recipient.email,
              recipient_name: recipient.name || recipient.email,
              template_name: context.templateName || `Template #${context.templateId}`,
              submitter_name: submitter?.name || submitter?.email || 'Unknown',
              submitted_at: submittedAt,
              assignment_id: String(context.assignmentId),
              submission_id: String(context.submissionId),
              tenant_login_url: this.getTenantLoginUrl(),
              logo_url: this.getLogoUrl(),
            },
            idempotencyKey: `dc:submission:${context.submissionId}:notify:${recipient.id}`,
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

    const dueDay = context.dueAt.toISOString().slice(0, 10);
    return this.sendMailSafe(req, {
      module: 'data-collection',
      action: 'assignment-due',
      tenantId: req?.tenantId || null,
      to: context.recipient.email,
      data: {
        email: context.recipient.email,
        recipient_name: context.recipient.name || context.recipient.email,
        template_name: context.templateName,
        due_at: context.dueAt.toISOString(),
        assignment_status: context.status,
        assignment_id: String(context.assignmentId),
        tenant_login_url: this.getTenantLoginUrl(),
        logo_url: this.getLogoUrl(),
      },
      idempotencyKey: `dc:assignment:${context.assignmentId}:due-reminder:${dueDay}`,
    });
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
