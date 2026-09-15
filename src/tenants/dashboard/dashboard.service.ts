import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Between, In, MoreThanOrEqual, Not } from 'typeorm';
import { User } from '../users/entities';
import { Item } from '../items/entities';
import { Vendor } from '../vendors/entities';
import { Form, FormAuditLog } from '../form-builder/entities';
import {
  AssignmentStatus,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  SubmissionStatus,
} from '../data-collection/entities';
import { ReportingGroup } from '../reporting-groups/entities';

type AccountType = 'tenant_admin' | 'tenant_user';
type AssignmentPriority = 'high' | 'medium' | 'low';
type ActivityType = 'submitted' | 'started' | 'assigned' | 'draft_saved';

@Injectable()
export class DashboardService {
  private formatRelativeTime(date: Date): string {
    const now = Date.now();
    const then = new Date(date).getTime();
    const seconds = Math.max(0, Math.floor((now - then) / 1000));

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }

  /** UTC midnight — matches how assignment dueAt values are materialized. */
  private startOfDayUtc(date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private endOfDayUtc(date = new Date()): Date {
    return new Date(this.startOfDayUtc(date).getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  private startOfMonth(date = new Date()): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private dayDiffFromToday(dueAt: Date, now = new Date()): number {
    const due = this.startOfDayUtc(dueAt).getTime();
    const today = this.startOfDayUtc(now).getTime();
    return Math.round((due - today) / (24 * 60 * 60 * 1000));
  }

  private formatDueLabel(dueAt: Date, status: AssignmentStatus, now = new Date()): string {
    if (status === AssignmentStatus.OVERDUE || this.dayDiffFromToday(dueAt, now) < 0) {
      return 'Overdue';
    }
    const diff = this.dayDiffFromToday(dueAt, now);
    if (diff === 0) return 'Due Today';
    if (diff === 1) return 'Due Tomorrow';
    if (diff > 1) return `Due in ${diff} days`;
    return 'Due Today';
  }

  private resolvePriority(dueAt: Date, status: AssignmentStatus, now = new Date()): AssignmentPriority {
    if (status === AssignmentStatus.OVERDUE || this.dayDiffFromToday(dueAt, now) < 0) {
      return 'high';
    }
    const diff = this.dayDiffFromToday(dueAt, now);
    if (diff <= 0) return 'high';
    if (diff <= 2) return 'medium';
    return 'low';
  }

  private firstName(fullName: string | null | undefined): string {
    const trimmed = String(fullName || '').trim();
    if (!trimmed) return 'there';
    return trimmed.split(/\s+/)[0];
  }

  private resolveAccountType(user: User): AccountType {
    const roleName = String(user.role?.name || '')
      .trim()
      .toLowerCase();

    if (
      roleName === 'admin' ||
      roleName.includes('admin') ||
      roleName.includes('manager') ||
      roleName.includes('owner')
    ) {
      return 'tenant_admin';
    }

    const permissionNames = (user.role?.permissions || []).map((p) =>
      typeof p === 'string' ? p : p.name,
    );
    const adminPermissionHints = [
      'create-user',
      'edit-user',
      'create-role',
      'create-dc-template',
      'edit-dc-template',
      'activate-dc-template',
      'archive-dc-template',
      'review-dc-submission',
    ];

    if (adminPermissionHints.some((name) => permissionNames.includes(name))) {
      return 'tenant_admin';
    }

    return 'tenant_user';
  }

  private getActorId(req: any): number | null {
    const candidate = req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private templateCategory(template?: DataCollectionTemplate | null): string {
    const schema = (template?.schema || {}) as Record<string, any>;
    const category =
      schema.category ||
      schema.department ||
      schema.formCategory ||
      schema.module ||
      schema.sections?.[0]?.title ||
      schema.sections?.[0]?.name;
    if (typeof category === 'string' && category.trim()) return category.trim();
    return 'Data Collection';
  }

  private humanizeAction(action: string, entityType: string): { title: string; description: string } {
    const entity = String(entityType || 'record').replace(/_/g, ' ');
    const act = String(action || 'updated').toLowerCase();

    const titles: Record<string, string> = {
      create: `${entity} created`,
      created: `${entity} created`,
      update: `${entity} updated`,
      updated: `${entity} updated`,
      delete: `${entity} deleted`,
      deleted: `${entity} deleted`,
      publish: `${entity} published`,
      published: `${entity} published`,
      assign: 'Form assigned',
      assigned: 'Form assigned',
    };

    return {
      title: titles[act] || `${entity} ${act}`,
      description: `${entity} was ${act}`,
    };
  }

  async getDashboard(req: any) {
    try {
      const connection = req.tenantConnection;
      if (!connection) {
        throw new InternalServerErrorException('Missing tenant connection');
      }

      const actorId = this.getActorId(req);
      if (actorId == null) {
        throw new InternalServerErrorException('Authenticated user required');
      }

      const userRepo = connection.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: actorId },
        relations: ['role', 'role.permissions'],
      });

      if (!user) {
        throw new InternalServerErrorException('Authenticated user not found');
      }

      const accountType = this.resolveAccountType(user);
      if (accountType === 'tenant_user') {
        return this.getEmployeeDashboard(req, user, accountType);
      }

      return this.getAdminDashboard(req, user, accountType);
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      console.error('Tenant dashboard failed:', error);
      throw new InternalServerErrorException('Failed to load tenant dashboard');
    }
  }

  private async getEmployeeDashboard(req: any, user: User, accountType: AccountType) {
    const connection = req.tenantConnection;
    const assignmentRepo = connection.getRepository(DataCollectionAssignment);
    const submissionRepo = connection.getRepository(DataCollectionSubmission);
    const now = new Date();
    const monthStart = this.startOfMonth(now);
    const startOfToday = this.startOfDayUtc(now);
    const endOfToday = this.endOfDayUtc(now);
    const actorId = user.id;

    const openStatuses = [
      AssignmentStatus.PENDING,
      AssignmentStatus.IN_PROGRESS,
      AssignmentStatus.OVERDUE,
    ];

    const [myAssignments, inProgress, completedThisMonth, overdue, todayAssignments, recentSubmissions, recentStarted, recentAssigned] =
      await Promise.all([
        assignmentRepo.count({
          where: {
            assigneeUserId: actorId,
            status: Not(AssignmentStatus.CANCELLED),
          },
        }),
        assignmentRepo.count({
          where: { assigneeUserId: actorId, status: AssignmentStatus.IN_PROGRESS },
        }),
        assignmentRepo.count({
          where: {
            assigneeUserId: actorId,
            status: AssignmentStatus.COMPLETED,
            updatedAt: MoreThanOrEqual(monthStart),
          },
        }),
        assignmentRepo.count({
          where: { assigneeUserId: actorId, status: AssignmentStatus.OVERDUE },
        }),
        assignmentRepo.find({
          where: {
            assigneeUserId: actorId,
            status: In(openStatuses),
            dueAt: Between(startOfToday, endOfToday),
          },
          relations: ['template'],
          order: { dueAt: 'ASC' },
          take: 8,
        }),
        submissionRepo.find({
          where: { submittedBy: actorId },
          relations: ['assignment', 'assignment.template'],
          order: { updatedAt: 'DESC' },
          take: 10,
        }),
        assignmentRepo.find({
          where: { assigneeUserId: actorId, status: AssignmentStatus.IN_PROGRESS },
          relations: ['template'],
          order: { updatedAt: 'DESC' },
          take: 5,
        }),
        assignmentRepo.find({
          where: {
            assigneeUserId: actorId,
            status: In([AssignmentStatus.PENDING, AssignmentStatus.OVERDUE]),
            createdAt: MoreThanOrEqual(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
          },
          relations: ['template'],
          order: { createdAt: 'DESC' },
          take: 5,
        }),
      ]);

    const todaysAssignments = todayAssignments.map((assignment) => {
      const title = assignment.template?.name || 'Assignment';
      return {
        id: assignment.id,
        title,
        category: this.templateCategory(assignment.template),
        dueAt: assignment.dueAt,
        dueLabel: this.formatDueLabel(assignment.dueAt, assignment.status, now),
        priority: this.resolvePriority(assignment.dueAt, assignment.status, now),
        status: assignment.status,
        templateId: assignment.templateId,
      };
    });

    const activityMap = new Map<
      string,
      {
        id: string;
        type: ActivityType;
        description: string;
        createdAt: Date;
        relativeTime: string;
        assignmentId: number | null;
      }
    >();

    for (const submission of recentSubmissions) {
      const title = submission.assignment?.template?.name || 'assignment';
      if (submission.status === SubmissionStatus.SUBMITTED) {
        const at = submission.submittedAt || submission.updatedAt;
        activityMap.set(`submitted-${submission.id}`, {
          id: `submitted-${submission.id}`,
          type: 'submitted',
          description: `You submitted ${title}`,
          createdAt: at,
          relativeTime: this.formatRelativeTime(at),
          assignmentId: submission.assignmentId,
        });
      } else {
        activityMap.set(`draft-${submission.id}`, {
          id: `draft-${submission.id}`,
          type: 'draft_saved',
          description: `You saved draft for ${title}`,
          createdAt: submission.updatedAt,
          relativeTime: this.formatRelativeTime(submission.updatedAt),
          assignmentId: submission.assignmentId,
        });
      }
    }

    for (const assignment of recentStarted) {
      const title = assignment.template?.name || 'assignment';
      activityMap.set(`started-${assignment.id}`, {
        id: `started-${assignment.id}`,
        type: 'started',
        description: `You started ${title}`,
        createdAt: assignment.updatedAt,
        relativeTime: this.formatRelativeTime(assignment.updatedAt),
        assignmentId: assignment.id,
      });
    }

    for (const assignment of recentAssigned) {
      const title = assignment.template?.name || 'assignment';
      activityMap.set(`assigned-${assignment.id}`, {
        id: `assigned-${assignment.id}`,
        type: 'assigned',
        description: `New assignment ${title}`,
        createdAt: assignment.createdAt,
        relativeTime: this.formatRelativeTime(assignment.createdAt),
        assignmentId: assignment.id,
      });
    }

    const recentActivity = Array.from(activityMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    const displayName = String(user.name || '').trim() || 'Employee';

    return {
      success: true,
      tenant: connection.options.database,
      tenant_slug: req.tenantId || null,
      account_type: accountType,
      data: {
        welcome: {
          message: `Welcome Back, ${this.firstName(displayName)}! Here's what's on your plate today.`,
          firstName: this.firstName(displayName),
          fullName: displayName,
          role: user.role?.name || 'Employee',
        },
        stats: {
          myAssignments: {
            value: myAssignments,
            label: 'Total assigned',
          },
          inProgress: {
            value: inProgress,
            label: 'Currently in progress',
          },
          completed: {
            value: completedThisMonth,
            label: 'This month',
          },
          overdue: {
            value: overdue,
            label: 'Needs attention',
          },
        },
        todaysAssignments,
        recentActivity,
      },
    };
  }

  private async getAdminDashboard(req: any, user: User, accountType: AccountType) {
    const connection = req.tenantConnection;
    const userRepo = connection.getRepository(User);
    const itemRepo = connection.getRepository(Item);
    const vendorRepo = connection.getRepository(Vendor);
    const formRepo = connection.getRepository(Form);
    const dcTemplateRepo = connection.getRepository(DataCollectionTemplate);
    const reportingGroupRepo = connection.getRepository(ReportingGroup);

    const [totalUsers, totalItems, totalVendors, totalBuilderForms, totalDcTemplates] =
      await Promise.all([
        userRepo.count({ where: { isSystem: Not(true) } as any }),
        itemRepo.count(),
        vendorRepo.count(),
        formRepo.count(),
        dcTemplateRepo.count(),
      ]);

    const totalForms = totalBuilderForms + totalDcTemplates;

    let recentActivity: Array<{
      id: number;
      title: string;
      description: string;
      createdAt: Date;
      relativeTime: string;
      entityType: string;
      action: string;
    }> = [];

    try {
      const auditRepo = connection.getRepository(FormAuditLog);
      const logs = await auditRepo.find({
        order: { createdAt: 'DESC' },
        take: 10,
      });
      recentActivity = logs.map((log) => {
        const { title, description } = this.humanizeAction(log.action, log.entityType);
        return {
          id: log.id,
          title,
          description,
          createdAt: log.createdAt,
          relativeTime: this.formatRelativeTime(log.createdAt),
          entityType: log.entityType,
          action: log.action,
        };
      });
    } catch {
      recentActivity = [];
    }

    const reportingGroups = await reportingGroupRepo.find({
      where: { isActive: true } as any,
      relations: ['reportingCategories', 'reportingCategories.items'],
      order: { id: 'ASC' },
    });

    const reportingGroupsOverview = reportingGroups.map((group) => {
      const categories = (group.reportingCategories || []).map((c) => ({
        id: c.id,
        name: c.name,
        itemCount: (c.items || []).length,
        items: (c.items || []).map((item) => ({
          id: item.id,
          itemName: item.itemName,
        })),
      }));
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        categories,
        categoryNames: categories.map((c) => c.name),
        itemCount: categories.reduce((sum, c) => sum + c.itemCount, 0),
      };
    });

    return {
      success: true,
      tenant: connection.options.database,
      tenant_slug: req.tenantId || null,
      account_type: accountType,
      data: {
        overview: {
          totalUsers,
          totalItems,
          totalVendors,
          totalForms,
          labels: {
            totalUsers: 'Active kitchen & floor staff',
            totalItems: 'Inventory catalog',
            totalVendors: 'Suppliers & services',
            totalForms: 'Ops & compliance forms',
          },
          breakdown: {
            formBuilderForms: totalBuilderForms,
            dataCollectionTemplates: totalDcTemplates,
          },
        },
        inventory: {
          totalItems,
          lowStock: 0,
          belowPar: 0,
          orderRequired: 0,
          available: false,
        },
        recentActivity,
        reportingGroups: reportingGroupsOverview,
        user: {
          id: user.id,
          name: user.name,
          role: user.role?.name || null,
        },
      },
    };
  }
}
