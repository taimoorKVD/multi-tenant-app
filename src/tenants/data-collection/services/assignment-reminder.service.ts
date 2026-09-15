import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Repository } from 'typeorm';
import { Tenant } from '../../../master/tenants/entities';
import { TenantsService } from '../../../master/tenants/tenants.service';
import {
  AssignmentStatus,
  DataCollectionAssignment,
  DataCollectionTemplate,
  TemplateStatus,
} from '../entities';
import { WorkflowActionsService } from './workflow-actions.service';

/**
 * Hourly job: mark overdue assignments and email assignees whose work is due today
 * (or already overdue and still open).
 */
@Injectable()
export class AssignmentReminderService {
  private readonly logger = new Logger(AssignmentReminderService.name);
  private running = false;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantsService: TenantsService,
    private readonly workflowActions: WorkflowActionsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyReminders() {
    if (process.env.DC_ASSIGNMENT_REMINDERS_ENABLED === 'false') {
      return;
    }
    await this.runForAllTenants();
  }

  async runForAllTenants(): Promise<{
    tenantsProcessed: number;
    remindersSent: number;
    overdueMarked: number;
    errors: string[];
  }> {
    if (this.running) {
      return { tenantsProcessed: 0, remindersSent: 0, overdueMarked: 0, errors: ['Already running'] };
    }

    this.running = true;
    const errors: string[] = [];
    let tenantsProcessed = 0;
    let remindersSent = 0;
    let overdueMarked = 0;

    try {
      const tenants = await this.tenantRepo.find();
      for (const tenant of tenants) {
        try {
          const result = await this.runForTenant(tenant);
          tenantsProcessed += 1;
          remindersSent += result.remindersSent;
          overdueMarked += result.overdueMarked;
        } catch (error) {
          const message = `Tenant ${tenant.subdomain}: ${(error as Error).message}`;
          this.logger.error(message);
          errors.push(message);
        }
      }
    } finally {
      this.running = false;
    }

    this.logger.log(
      `DC reminders complete: tenants=${tenantsProcessed}, sent=${remindersSent}, overdue=${overdueMarked}, errors=${errors.length}`,
    );

    return { tenantsProcessed, remindersSent, overdueMarked, errors };
  }

  async runForTenant(tenant: Tenant): Promise<{ remindersSent: number; overdueMarked: number }> {
    const connection = await this.tenantsService.getTenantConnection(tenant.subdomain);
    const req = {
      tenantId: tenant.subdomain,
      tenantConnection: connection,
      tenant,
    };

    const assignmentRepo = connection.getRepository(DataCollectionAssignment);
    const templateRepo = connection.getRepository(DataCollectionTemplate);

    const now = new Date();
    const overdueResult = await assignmentRepo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({ status: AssignmentStatus.OVERDUE })
      .where('status IN (:...statuses)', {
        statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
      })
      .andWhere('due_at < :now', { now })
      .execute();

    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

    const dueToday = await assignmentRepo.find({
      where: [
        {
          status: In([AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS, AssignmentStatus.OVERDUE]),
          dueAt: Between(startOfToday, endOfToday),
        },
        {
          status: AssignmentStatus.OVERDUE,
          dueAt: LessThanOrEqual(endOfToday),
        },
      ],
    });

    // Dedupe by id (OVERDUE + dueToday overlap)
    const byId = new Map<number, DataCollectionAssignment>();
    for (const row of dueToday) byId.set(row.id, row);

    let remindersSent = 0;
    for (const assignment of byId.values()) {
      if (!assignment.assigneeUserId) continue;

      const [assignee] = await this.workflowActions.resolveUsersByIds(req, [
        assignment.assigneeUserId,
      ]);
      if (!assignee?.email) continue;

      const template = await templateRepo.findOne({ where: { id: assignment.templateId } });
      if (
        !template ||
        template.deletedAt ||
        template.status === TemplateStatus.ARCHIVED ||
        !template.isActive
      ) {
        continue;
      }

      const result = await this.workflowActions.sendAssignmentDueReminder(req, {
        assignmentId: assignment.id,
        templateName: template.name || `Template #${assignment.templateId}`,
        dueAt: assignment.dueAt,
        status: assignment.status,
        recipient: assignee,
      });

      if (result.status === 'sent' || result.status === 'queued') {
        remindersSent += 1;
      }
    }

    return {
      remindersSent,
      overdueMarked: overdueResult.affected ?? 0,
    };
  }
}
