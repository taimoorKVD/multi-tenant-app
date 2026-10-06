import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { In } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { User } from '../../users/entities';
import { Item } from '../../items/entities';
import { emailEscape, renderEmailLayout } from '../../../mail/utils/email-layout.util';
import {
  prepareEmailLogo,
  toNodemailerLogoAttachments,
  type PreparedEmailLogo,
} from '../../../mail/utils/email-logo.util';
import {
  AssignmentType,
  ManagerRequestKind,
  ManagerRequestStatus,
  WorkflowActionType,
} from '../entities/enums';
import { DcManagerRequest } from '../entities/dc-manager-request.entity';
import { DcWorkflowExecution } from '../entities/dc-workflow-execution.entity';
import {
  parseExclusiveAssignReportTargets,
  resolveAssignReportMode,
} from '../utils/assignment-completion.util';
import { extractRequestDisplay } from '../utils/workflow-operators.util';
import { WorkflowRuleEngineService } from './workflow-rule-engine.service';

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

  constructor(@Optional() private readonly ruleEngine?: WorkflowRuleEngineService) {}

  private getEnvValue(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = process.env[key]?.trim();
      if (value) return value;
    }
    return undefined;
  }

  private getFrontendBaseUrl(): string {
    const configured = this.getEnvValue('FRONTEND_URL', 'APP_FRONTEND_URL');
    if (configured) return configured.replace(/\/+$/, '');
    return 'http://localhost:4200';
  }

  private getPlatformHost(): string {
    const explicit = this.getEnvValue('PLATFORM_DOMAIN');
    if (explicit) return explicit.replace(/^\./, '').replace(/\/+$/, '');

    try {
      return new URL(this.getFrontendBaseUrl()).hostname.replace(/^(www|admin)\./, '');
    } catch {
      return 'eusocial.thebetawebsite.com';
    }
  }

  private getTenantAppUrl(subdomain: string, customDomain?: string | null): string {
    if (customDomain?.trim()) {
      const host = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const protocol = host.includes('localhost') ? 'http' : 'https';
      return `${protocol}://${host}`;
    }

    let protocol = 'https';
    let port = '';
    try {
      const frontend = new URL(this.getFrontendBaseUrl());
      protocol = frontend.protocol.replace(':', '') || 'https';
      port = frontend.port ? `:${frontend.port}` : '';
    } catch {
      protocol = 'https';
    }

    return `${protocol}://${subdomain}.${this.getPlatformHost()}${port}`;
  }

  /** Tenant workspace URL, e.g. https://folio3.eusocial.thebetawebsite.com/ */
  private getTenantLoginUrl(req?: any): string {
    const slug = String(
      req?.tenant?.subdomain || req?.tenantId || req?.tenantSlug || '',
    )
      .trim()
      .toLowerCase();
    const customDomain = req?.tenant?.customDomain || req?.customDomain || null;

    if (slug && !/^\d+$/.test(slug)) {
      return `${this.getTenantAppUrl(slug, customDomain)}/`;
    }

    return `${this.getFrontendBaseUrl()}/`;
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

  private wrapHtml(
    title: string,
    intro: string,
    rows: Array<{ label: string; value: string }>,
    ctaLabel: string,
    logoSrc: string,
    ctaUrl: string,
  ): string {
    return renderEmailLayout({
      logoUrl: logoSrc,
      title,
      preheader: title,
      introHtml: `<p style="margin:0;">${intro}</p>`,
      rows: rows.map((row) => ({
        label: row.label,
        value: row.value,
      })),
      stackedRows: true,
      cta: { label: ctaLabel, url: ctaUrl },
    });
  }

  private async sendDirectSmtpMail(options: {
    to: string;
    subject: string;
    html: string;
    logo?: PreparedEmailLogo;
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

      const preparedLogo = options.logo || (await prepareEmailLogo());
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
        attachments: toNodemailerLogoAttachments(preparedLogo.attachment),
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
      answers?: Record<string, any>;
      templateVersionId?: number;
    },
  ): Promise<{ actions: Array<{ type: string; status: string; detail?: string; mode?: string }> }> {
    const schema = context.schema || {};
    const submitter = await this.resolveUser(req, context.submittedBy);
    const rules = Array.isArray(schema.conditionalRules) ? schema.conditionalRules : null;

    if (!rules) {
      const configured: Array<{ type: string; [key: string]: any }> = Array.isArray(
        schema.workflow?.actions,
      )
        ? schema.workflow.actions
        : [{ type: 'notify', targets: 'report' }];
      return this.runLegacyActions(req, context, schema, configured, submitter);
    }

    const engine = this.ruleEngine ?? new WorkflowRuleEngineService();
    const results: Array<{ type: string; status: string; detail?: string; mode?: string }> = [];
    const answers = context.answers || {};
    let notified = false;

    for (const rule of rules) {
      const evaluation = await engine.evaluateRule(req, rule, answers, schema);
      const actionsFired: Array<{ id?: string; type?: string; status: string }> = [];

      if (evaluation.matched) {
        for (const action of Array.isArray(rule.actions) ? rule.actions : []) {
          const type = String(action?.type || '');
          if (type === WorkflowActionType.SEND_NOTIFICATION || type === WorkflowActionType.NOTIFY) {
            const portalRow = await this.createManagerRequest(
              req,
              context,
              schema,
              action,
              rule,
              submitter,
            );
            results.push({
              type: 'notificationRequest',
              status: portalRow.status,
              detail: portalRow.detail,
            });
            actionsFired.push({
              id: action.id,
              type: 'notificationRequest',
              status: portalRow.status,
            });

            if (!notified) {
              const notifyResult = await this.notifyReportRecipients(req, context, schema, submitter);
              results.push(notifyResult);
              notified = true;
              actionsFired.push({ id: action.id, type, status: notifyResult.status });
            } else {
              actionsFired.push({ id: action.id, type, status: 'deduped' });
              results.push({ type, status: 'deduped', detail: `rule=${evaluation.ruleId}` });
            }
            continue;
          }

          if (
            type === WorkflowActionType.PURCHASE_REQUEST ||
            type === WorkflowActionType.MAINTENANCE_REQUEST
          ) {
            const created = await this.createManagerRequest(
              req,
              context,
              schema,
              action,
              rule,
              submitter,
            );
            actionsFired.push({ id: action.id, type, status: created.status });
            results.push({ type, status: created.status, detail: created.detail });
            continue;
          }

          actionsFired.push({ id: action?.id, type: type || 'unknown', status: 'skipped' });
          results.push({ type: type || 'unknown', status: 'skipped' });
        }
      } else {
        results.push({
          type: 'rule',
          status: evaluation.skipReason || 'no_match',
          detail: `rule=${evaluation.ruleId}`,
        });
      }

      await this.recordExecution(req, context, evaluation, actionsFired);
    }

    return { actions: results };
  }

  private async runLegacyActions(
    req: any,
    context: {
      templateId: number;
      templateName: string;
      assignmentId: number;
      submissionId: number;
      submittedBy: number | null;
    },
    schema: Record<string, any>,
    configured: Array<{ type: string; [key: string]: any }>,
    submitter: DcMailRecipient | null,
  ) {
    const results: Array<{ type: string; status: string; detail?: string; mode?: string }> = [];

    for (const action of configured) {
      if (action.type === 'notify') {
        results.push(await this.notifyReportRecipients(req, context, schema, submitter));
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

  async notifyReportRecipients(
    req: any,
    context: {
      templateId: number;
      templateName: string;
      assignmentId: number;
      submissionId: number;
    },
    schema: Record<string, any>,
    submitter: DcMailRecipient | null,
  ): Promise<{ type: string; status: string; detail?: string; mode?: string }> {
    const report = schema.report || {};
    const reportMode = resolveAssignReportMode(report);
    const recipients = await this.resolveReportRecipients(req, report);
    const withEmail = recipients.filter((r) => !!r.email);
    const templateName = context.templateName || `Template #${context.templateId}`;
    const submittedAt = new Date().toISOString();

    if (!withEmail.length) {
      return {
        type: 'notify',
        status: 'skipped',
        detail: 'No report recipients with email',
        mode: reportMode,
      };
    }

    let sent = 0;
    let failed = 0;
    const preparedLogo = await prepareEmailLogo();
    const workspaceUrl = this.getTenantLoginUrl(req);
    const fields = [
      { label: 'Form', value: templateName },
      {
        label: 'Submitted by',
        value: submitter?.name || submitter?.email || 'Unknown',
      },
      { label: 'Submitted at', value: submittedAt },
      { label: 'Assignment ID', value: String(context.assignmentId) },
      { label: 'Submission ID', value: String(context.submissionId) },
    ];

    if (reportMode === AssignmentType.SHARED) {
      const result = await this.sendDirectSmtpMail({
        to: withEmail.map((r) => r.email!).join(', '),
        subject: `New submission: ${templateName}`,
        logo: preparedLogo,
        html: this.wrapHtml(
          'New Data Collection Submission',
          `A form was submitted and your group was listed as shared report recipients.`,
          fields,
          'Open Workspace',
          preparedLogo.logoSrc,
          workspaceUrl,
        ),
      });
      if (result.status === 'failed') failed = withEmail.length;
      else sent = withEmail.length;
    } else {
      for (const recipient of withEmail) {
        const result = await this.sendDirectSmtpMail({
          to: recipient.email!,
          subject: `New submission: ${templateName}`,
          logo: preparedLogo,
          html: this.wrapHtml(
            'New Data Collection Submission',
            `Hi ${emailEscape(recipient.name || recipient.email || '')}, a form was submitted and you were listed as a report recipient.`,
            fields,
            'Open Workspace',
            preparedLogo.logoSrc,
            workspaceUrl,
          ),
        });
        if (result.status === 'failed') failed += 1;
        else sent += 1;
      }
    }

    return {
      type: 'notify',
      status: failed && !sent ? 'failed' : failed ? 'partial' : 'sent',
      detail: `mode=${reportMode}; recipients emailed: ${sent}, failed: ${failed}`,
      mode: reportMode,
    };
  }

  async sendLayoutMail(options: {
    req?: any;
    to: string;
    subject: string;
    title: string;
    intro: string;
    rows: Array<{ label: string; value: string }>;
    ctaLabel?: string;
  }): Promise<{ status: string; detail?: string }> {
    const preparedLogo = await prepareEmailLogo();
    const workspaceUrl = this.getTenantLoginUrl(options.req);
    return this.sendDirectSmtpMail({
      to: options.to,
      subject: options.subject,
      logo: preparedLogo,
      html: this.wrapHtml(
        options.title,
        options.intro,
        options.rows,
        options.ctaLabel || 'Open Workspace',
        preparedLogo.logoSrc,
        workspaceUrl,
      ),
    });
  }

  private async recordExecution(
    req: any,
    context: {
      templateId: number;
      assignmentId: number;
      submissionId: number;
      templateVersionId?: number;
    },
    evaluation: {
      ruleId: string;
      ruleName: string;
      matched: boolean;
      skipReason: string | null;
      conditionResults: unknown[];
    },
    actionsFired: unknown[],
  ): Promise<void> {
    if (!req?.tenantConnection || !context.templateVersionId) return;
    try {
      const repo = req.tenantConnection.getRepository(DcWorkflowExecution);
      await repo.save(
        repo.create({
          submissionId: context.submissionId,
          assignmentId: context.assignmentId,
          templateId: context.templateId,
          templateVersionId: context.templateVersionId,
          ruleClientId: evaluation.ruleId || 'unknown',
          ruleName: evaluation.ruleName || null,
          matched: evaluation.matched,
          skipReason: evaluation.skipReason,
          conditionResults: evaluation.conditionResults,
          actionsFired,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to record workflow execution: ${(error as Error).message}`);
    }
  }

  private async createManagerRequest(
    req: any,
    context: {
      templateId: number;
      assignmentId: number;
      submissionId: number;
      templateVersionId?: number;
      answers?: Record<string, any>;
    },
    schema: Record<string, any>,
    action: { id?: string; type?: string },
    rule: { id?: string; name?: string },
    submitter: DcMailRecipient | null,
  ): Promise<{ status: string; detail?: string }> {
    if (!req?.tenantConnection || !context.templateVersionId) {
      return { status: 'skipped', detail: 'Missing tenant connection or template version' };
    }

    const kind = this.resolveManagerRequestKind(action.type);
    const repo = req.tenantConnection.getRepository(DcManagerRequest);
    const actionClientId = String(action.id || action.type || 'action');
    const ruleClientId = String(rule.id || 'rule');

    const existing = await repo.findOne({
      where: {
        submissionId: context.submissionId,
        ruleClientId,
        actionClientId,
      },
    });
    if (existing) {
      return { status: 'exists', detail: `requestId=${existing.id}` };
    }

    const display = extractRequestDisplay(schema, context.answers || {});
    let itemLabel = display.itemLabel;
    if (!itemLabel && display.itemId) {
      const item = await req.tenantConnection.getRepository(Item).findOne({
        where: { id: display.itemId },
      });
      itemLabel = item?.itemName || null;
    }

    const ruleName = String(rule.name || '').trim();
    const note =
      kind === ManagerRequestKind.NOTIFICATION
        ? ruleName || display.note || 'Workflow notification'
        : display.note;

    const saved = await repo.save(
      repo.create({
        kind,
        status: ManagerRequestStatus.OPEN,
        submissionId: context.submissionId,
        assignmentId: context.assignmentId,
        templateId: context.templateId,
        templateVersionId: context.templateVersionId,
        ruleClientId,
        actionClientId,
        requestedByUserId: submitter?.id ?? null,
        requesterName: submitter?.name || submitter?.email || null,
        itemId: display.itemId,
        vendorId: display.vendorId,
        itemLabel,
        note,
        quantity: display.quantity,
        quotedPrice: display.quotedPrice,
        answersSnapshot: context.answers || {},
      }),
    );

    return { status: 'created', detail: `requestId=${saved.id}` };
  }

  private resolveManagerRequestKind(actionType?: string): ManagerRequestKind {
    if (
      actionType === WorkflowActionType.SEND_NOTIFICATION ||
      actionType === WorkflowActionType.NOTIFY
    ) {
      return ManagerRequestKind.NOTIFICATION;
    }
    if (actionType === WorkflowActionType.MAINTENANCE_REQUEST) {
      return ManagerRequestKind.MAINTENANCE;
    }
    return ManagerRequestKind.PURCHASE;
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

    const preparedLogo = await prepareEmailLogo();
    return this.sendDirectSmtpMail({
      to: context.recipient.email,
      subject: `Reminder: ${context.templateName} is due ${this.formatDateTime(context.dueAt)}`,
      logo: preparedLogo,
      html: this.wrapHtml(
        'Assignment Due Reminder',
        `Hi ${emailEscape(context.recipient.name || context.recipient.email || '')}, you have a data collection assignment that is due.`,
        [
          { label: 'Form', value: context.templateName },
          { label: 'Due', value: this.formatDateTime(context.dueAt) },
          { label: 'Status', value: context.status },
          { label: 'Assignment ID', value: String(context.assignmentId) },
        ],
        'Complete Assignment',
        preparedLogo.logoSrc,
        this.getTenantLoginUrl(req),
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
    const preparedLogo = await prepareEmailLogo();
    const workspaceUrl = this.getTenantLoginUrl(req);

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
        logo: preparedLogo,
        html: this.wrapHtml(
          'You Have a New Assignment',
          `Hi ${emailEscape(recipient.name || recipient.email || '')}, a data collection form was published and assigned to you.`,
          [
            { label: 'Form', value: templateName },
            { label: 'First due', value: this.formatDateTime(assignment.dueAt) },
            { label: 'Occurrences', value: String(assignmentCount) },
            { label: 'Assignment ID', value: String(assignment.id) },
          ],
          "Open Today's Work",
          preparedLogo.logoSrc,
          workspaceUrl,
        ),
      });

      if (result.status === 'failed') failed += 1;
      else sent += 1;
    }

    return { sent, failed, skipped };
  }

  async resolveReportRecipients(
    req: any,
    report: { users?: number[] | null; jobPosition?: number[] | null },
  ): Promise<DcMailRecipient[]> {
    const selection = parseExclusiveAssignReportTargets(report);
    if (selection.hasUsers && selection.hasJobPositions) {
      throw new BadRequestException(
        'Choose either Users or Job Positions for Report To — not both.',
      );
    }

    if (selection.hasUsers) {
      return this.resolveUsersByIds(req, selection.users);
    }

    if (selection.hasJobPositions) {
      const userIds = await this.resolveUserIdsByJobPositions(req, selection.jobPosition);
      return this.resolveUsersByIds(req, userIds);
    }

    return [];
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

  private async resolveUserIdsByJobPositions(req: any, jobPositionIds: number[]): Promise<number[]> {
    if (!jobPositionIds.length) return [];
    try {
      const userRepo = req.tenantConnection.getRepository(User);
      const rows: Array<{ id: number }> = await userRepo
        .createQueryBuilder('u')
        .select('u.id', 'id')
        .where('u.job_position_id IN (:...jobPositionIds)', { jobPositionIds })
        .getRawMany();
      return rows.map((row) => Number(row.id)).filter(Number.isFinite);
    } catch {
      return [];
    }
  }
}
