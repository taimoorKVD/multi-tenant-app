import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { User } from '../../users/entities';
import {
  AssignmentCancelReason,
  AssignmentStatus,
  AssignmentType,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  SubmissionStatus,
  TemplateStatus,
  TemplateVersion,
} from '../entities';
import { QueryAssignmentDto } from '../dto/assignments/query-assignment.dto';
import {
  buildAssignmentCompletion,
  parseExclusiveAssignReportTargets,
  resolveAssignReportMode,
} from '../utils/assignment-completion.util';
import { FrequencyService } from './frequency.service';

@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(private readonly frequencyService: FrequencyService) {}

  private getActorId(req: any): number | null {
    const candidate = req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  /** UTC midnight — matches how assignment dueAt values are materialized. */
  private startOfDayUtc(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private endOfDayUtc(date: Date): Date {
    return new Date(this.startOfDayUtc(date).getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  /** Parse YYYY-MM-DD as a UTC calendar day, or null if invalid. */
  private parseUtcDateOnly(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  /**
   * Resolve due-date day filter for `status=today` and/or `date`.
   * When both are present, `date` selects the day (status=today is a day-view filter, not a DB status).
   */
  private resolveDueDayFilter(query: QueryAssignmentDto): { start: Date; end: Date } | null {
    const isTodayStatus = query.status === 'today';
    if (!isTodayStatus && !query.date) return null;

    let day: Date;
    if (query.date) {
      const parsed = this.parseUtcDateOnly(query.date);
      if (!parsed) throw new BadRequestException('date must be a valid YYYY-MM-DD string');
      day = parsed;
    } else {
      day = this.startOfDayUtc(new Date());
    }

    return { start: this.startOfDayUtc(day), end: this.endOfDayUtc(day) };
  }

  private resolveFormName(template?: DataCollectionTemplate | null): string | null {
    if (!template) return null;
    const name = String(template.name || '').trim();
    const schemaName =
      template.schema && typeof (template.schema as any).formName === 'string'
        ? String((template.schema as any).formName).trim()
        : '';
    return name || schemaName || null;
  }

  private serializeSubmission(submission?: DataCollectionSubmission | null) {
    if (!submission) return null;
    return {
      id: submission.id,
      assignmentId: submission.assignmentId,
      templateVersionId: submission.templateVersionId,
      submittedBy: submission.submittedBy,
      answers: submission.answers || {},
      response: submission.answers || {},
      status: submission.status,
      submittedAt: submission.submittedAt,
      createdBy: submission.createdBy,
      updatedBy: submission.updatedBy,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }

  private pickLatestSubmission(
    submissions: DataCollectionSubmission[],
  ): DataCollectionSubmission | null {
    if (!submissions.length) return null;
    const submitted = submissions
      .filter((s) => s.status === SubmissionStatus.SUBMITTED)
      .sort(
        (a, b) =>
          new Date(b.submittedAt || b.updatedAt).getTime() -
          new Date(a.submittedAt || a.updatedAt).getTime(),
      );
    if (submitted[0]) return submitted[0];

    return [...submissions].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )[0];
  }

  private async loadSubmissionsByAssignmentIds(
    req: any,
    assignmentIds: number[],
  ): Promise<Map<number, DataCollectionSubmission>> {
    const map = new Map<number, DataCollectionSubmission>();
    if (!assignmentIds.length) return map;

    const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
    const rows: DataCollectionSubmission[] = await submissionRepo.find({
      where: { assignmentId: In(assignmentIds) },
      order: { updatedAt: 'DESC' },
    });

    const grouped = new Map<number, DataCollectionSubmission[]>();
    for (const row of rows) {
      const list = grouped.get(row.assignmentId) || [];
      list.push(row);
      grouped.set(row.assignmentId, list);
    }

    for (const [assignmentId, list] of grouped.entries()) {
      const picked = this.pickLatestSubmission(list);
      if (picked) map.set(assignmentId, picked);
    }

    return map;
  }

  private async loadUserNamesByIds(
    req: any,
    userIds: number[],
  ): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    const uniqueIds = [...new Set(userIds.filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) return map;

    const userRepo = req.tenantConnection.getRepository(User);
    const users: User[] = await userRepo.find({
      where: { id: In(uniqueIds) },
      select: ['id', 'name'],
    });
    for (const user of users) {
      map.set(user.id, (user.name || '').trim() || `User #${user.id}`);
    }
    return map;
  }

  private serializeAssignment(
    assignment: DataCollectionAssignment,
    submission?: DataCollectionSubmission | null,
    options?: {
      viewerUserId?: number | null;
      completedByName?: string | null;
    },
  ) {
    const formName = this.resolveFormName(assignment.template);
    const submissionPayload = this.serializeSubmission(submission);
    const completedAt = assignment.completedAt || submissionPayload?.submittedAt || null;
    const completedByUserId =
      assignment.completedByUserId ?? submissionPayload?.submittedBy ?? null;
    const completion = buildAssignmentCompletion({
      status: assignment.status,
      assignmentType: assignment.assignmentType || AssignmentType.INDIVIDUAL,
      completedByUserId,
      completedAt,
      completedByName: options?.completedByName ?? null,
      viewerUserId: options?.viewerUserId ?? null,
    });

    return {
      ...assignment,
      mode: assignment.assignmentType || AssignmentType.INDIVIDUAL,
      formName,
      templateName: formName,
      submissionId: submissionPayload?.id ?? null,
      submission: submissionPayload,
      completion,
    };
  }

  private async serializeAssignments(
    req: any,
    rows: DataCollectionAssignment[],
    viewerUserId?: number | null,
  ) {
    const submissionsByAssignment = await this.loadSubmissionsByAssignmentIds(
      req,
      rows.map((row) => row.id),
    );

    const completedByIds = rows
      .map((row) => {
        const submission = submissionsByAssignment.get(row.id);
        return row.completedByUserId ?? submission?.submittedBy ?? null;
      })
      .filter((id): id is number => id != null && Number.isFinite(id));

    const namesById = await this.loadUserNamesByIds(req, completedByIds);

    return rows.map((row) => {
      const submission = submissionsByAssignment.get(row.id) || null;
      const completedByUserId = row.completedByUserId ?? submission?.submittedBy ?? null;
      return this.serializeAssignment(row, submission, {
        viewerUserId,
        completedByName: completedByUserId != null ? namesById.get(completedByUserId) || null : null,
      });
    });
  }

  async findAll(req: any, query: QueryAssignmentDto) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;
      const actorId = this.getActorId(req);
      const mineOnly = query.mine === true || query.mine === 'true' || query.mine === '1';

      const qb = repo
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.template', 'template');

      // Employee portal: only active (non-archived / non-deleted) template work.
      if (mineOnly) {
        qb.andWhere('template.id IS NOT NULL')
          .andWhere('template.status = :templateStatus', {
            templateStatus: TemplateStatus.ACTIVE,
          })
          .andWhere('template.isActive = true')
          .andWhere('template.deletedAt IS NULL');
      }

      const isTodayStatus = query.status === 'today';
      if (query.status && !isTodayStatus) {
        qb.andWhere('assignment.status = :status', { status: query.status });
      } else if (mineOnly) {
        // Hide cancelled from default my-work and from status=today (due-day view).
        // Cancelled only appears when status=cancelled is requested explicitly.
        qb.andWhere('assignment.status != :cancelledStatus', {
          cancelledStatus: AssignmentStatus.CANCELLED,
        });
      }

      const dueDay = this.resolveDueDayFilter(query);
      if (dueDay) {
        qb.andWhere('assignment.dueAt BETWEEN :dueStart AND :dueEnd', {
          dueStart: dueDay.start,
          dueEnd: dueDay.end,
        });
      }

      if (query.templateId) {
        qb.andWhere('assignment.templateId = :templateId', { templateId: query.templateId });
      }

      if (query.assigneeUserId) {
        qb.andWhere('assignment.assigneeUserId = :assigneeUserId', {
          assigneeUserId: query.assigneeUserId,
        });
      } else if (mineOnly && actorId != null) {
        qb.andWhere('assignment.assigneeUserId = :assigneeUserId', { assigneeUserId: actorId });
      }

      qb.orderBy('assignment.dueAt', 'ASC').skip(skip).take(limit);
      const [rows, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;
      const data = await this.serializeAssignments(req, rows, actorId);

      return { success: true, meta: { total, page, lastPage }, data };
    } catch (error) {
      this.logger.error('Assignment findAll failed', error);
      throw new InternalServerErrorException('Failed to retrieve assignments');
    }
  }

  async findMyWork(req: any, query: QueryAssignmentDto) {
    const actorId = this.getActorId(req);
    if (actorId == null) throw new BadRequestException('Authenticated user required');
    return this.findAll(req, {
      ...query,
      mine: true,
      assigneeUserId: actorId,
      status: query.status,
    });
  }

  async findOne(req: any, id: number) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const assignment = await repo.findOne({
        where: { id },
        relations: ['template'],
      });
      if (!assignment) throw new NotFoundException(`Assignment with ID ${id} not found`);

      const [data] = await this.serializeAssignments(req, [assignment], this.getActorId(req));
      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve assignment');
    }
  }

  async start(req: any, id: number) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const assignment = await repo.findOne({
        where: { id },
        relations: ['template'],
      });
      if (!assignment) throw new NotFoundException(`Assignment with ID ${id} not found`);

      if (assignment.status === AssignmentStatus.COMPLETED) {
        throw new BadRequestException('Assignment is already completed');
      }
      if (assignment.status === AssignmentStatus.CANCELLED) {
        throw new BadRequestException('Assignment is cancelled');
      }

      const template = assignment.template;
      if (
        !template ||
        template.deletedAt ||
        template.status === TemplateStatus.ARCHIVED ||
        !template.isActive
      ) {
        throw new BadRequestException('This form is no longer available');
      }

      if (
        assignment.assignmentType === AssignmentType.SHARED &&
        assignment.sharedGroupKey
      ) {
        const siblingCompleted = await repo.findOne({
          where: {
            sharedGroupKey: assignment.sharedGroupKey,
            status: AssignmentStatus.COMPLETED,
          },
        });
        if (siblingCompleted) {
          throw new BadRequestException('This shared task was already completed by another user');
        }
      }

      assignment.status = AssignmentStatus.IN_PROGRESS;
      assignment.updatedBy = this.getActorId(req);
      const saved = await repo.save(assignment);
      const [data] = await this.serializeAssignments(req, [saved], this.getActorId(req));

      return {
        success: true,
        message: 'Assignment started',
        data,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to start assignment');
    }
  }

  /**
   * Materialize assignments from template schema.assign + schema.frequency.
   * Idempotent via occurrenceKey unique constraint.
   *
   * Restore / republish rules for an existing occurrenceKey:
   * - open → reuse
   * - completed → leave unchanged (do not create a duplicate open row)
   * - cancelled + template_archived (or legacy null) → reactivate
   * - cancelled + manual / republish → keep cancelled; create `:reopen` key if needed
   *
   * Individual: one open task per assignee × occurrence.
   * Shared: one row per assignee × occurrence, linked by sharedGroupKey so any
   * one submission completes the whole group.
   */
  async materializeFromTemplate(
    req: any,
    template: DataCollectionTemplate,
    version: TemplateVersion,
    actorId: number | null,
  ): Promise<DataCollectionAssignment[]> {
    const schema = (template.schema || version.schemaSnapshot || {}) as Record<string, any>;
    const assign = schema.assign || {};
    const frequency = schema.frequency;
    const assignmentType = resolveAssignReportMode(assign);

    const targetsSelection = parseExclusiveAssignReportTargets(assign);
    if (targetsSelection.hasUsers && targetsSelection.hasJobPositions) {
      throw new BadRequestException(
        'Choose either Users or Job Positions for Assign — not both.',
      );
    }

    const targets: Array<{ userId: number | null; jobPositionId: number | null }> = [];

    if (targetsSelection.hasUsers) {
      for (const userId of targetsSelection.users) {
        targets.push({ userId, jobPositionId: null });
      }
    } else if (targetsSelection.hasJobPositions) {
      // Expand each selected job position to every user currently in that position.
      const resolved = await this.resolveUsersByJobPositions(req, targetsSelection.jobPosition);
      for (const row of resolved) {
        targets.push({ userId: row.userId, jobPositionId: row.jobPositionId });
      }
      // Keep job-position placeholders when no users are assigned to those positions yet.
      if (!targets.length) {
        for (const jpId of targetsSelection.jobPosition) {
          targets.push({ userId: null, jobPositionId: jpId });
        }
      }
    }

    if (!targets.length) {
      this.logger.warn(`Template ${template.id}: no assignees; skipping assignment materialization`);
      return [];
    }

    const dueDates = this.frequencyService.expandOccurrences(frequency);
    if (!dueDates.length) {
      throw new BadRequestException('Frequency produced no occurrence dates. Check date and recurring settings.');
    }

    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const created: DataCollectionAssignment[] = [];

    for (const dueAt of dueDates) {
      for (const target of targets) {
        const dueIso = dueAt.toISOString();
        const occurrenceKey = [
          template.id,
          version.id,
          dueIso,
          target.userId != null ? `u:${target.userId}` : `jp:${target.jobPositionId}`,
        ].join(':');
        const sharedGroupKey =
          assignmentType === AssignmentType.SHARED
            ? [template.id, version.id, dueIso, 'shared'].join(':')
            : null;

        const resolved = await this.resolveOrCreateOccurrence(assignmentRepo, {
          occurrenceKey,
          sharedGroupKey,
          templateId: template.id,
          templateVersionId: version.id,
          assigneeUserId: target.userId,
          jobPositionId: target.jobPositionId,
          dueAt,
          assignmentType,
          actorId,
        });
        created.push(resolved);
      }
    }

    return created;
  }

  private reopenOccurrenceKey(occurrenceKey: string): string {
    return `${occurrenceKey}:reopen`;
  }

  private isOpenAssignmentStatus(status: AssignmentStatus): boolean {
    return (
      status === AssignmentStatus.PENDING ||
      status === AssignmentStatus.IN_PROGRESS ||
      status === AssignmentStatus.OVERDUE
    );
  }

  /** Archive-cancelled (and legacy null) may be reactivated; manual/republish may not. */
  private canReactivateCancelled(assignment: DataCollectionAssignment): boolean {
    if (assignment.status !== AssignmentStatus.CANCELLED) return false;
    return (
      assignment.cancelReason == null ||
      assignment.cancelReason === AssignmentCancelReason.TEMPLATE_ARCHIVED
    );
  }

  /**
   * dueAt is stored as UTC midnight of the due calendar day, so overdue is
   * "due day has fully passed", not "any time after midnight today".
   */
  private openStatusForDueAt(dueAt: Date, now = new Date()): AssignmentStatus {
    return this.startOfDayUtc(dueAt).getTime() < this.startOfDayUtc(now).getTime()
      ? AssignmentStatus.OVERDUE
      : AssignmentStatus.PENDING;
  }

  private async reactivateAssignment(
    assignmentRepo: any,
    assignment: DataCollectionAssignment,
    actorId: number | null,
    sharedGroupKey: string | null,
    assignmentType: AssignmentType,
  ): Promise<DataCollectionAssignment> {
    assignment.status = this.openStatusForDueAt(assignment.dueAt);
    assignment.cancelReason = null;
    assignment.assignmentType = assignmentType;
    assignment.sharedGroupKey = sharedGroupKey;
    assignment.completedByUserId = null;
    assignment.completedAt = null;
    assignment.updatedBy = actorId;
    return assignmentRepo.save(assignment);
  }

  private async createAssignmentRow(
    assignmentRepo: any,
    params: {
      occurrenceKey: string;
      sharedGroupKey: string | null;
      templateId: number;
      templateVersionId: number;
      assigneeUserId: number | null;
      jobPositionId: number | null;
      dueAt: Date;
      assignmentType: AssignmentType;
      actorId: number | null;
    },
  ): Promise<DataCollectionAssignment> {
    const row = assignmentRepo.create({
      templateId: params.templateId,
      templateVersionId: params.templateVersionId,
      assigneeUserId: params.assigneeUserId,
      jobPositionId: params.jobPositionId,
      dueAt: params.dueAt,
      status: this.openStatusForDueAt(params.dueAt),
      cancelReason: null,
      assignmentType: params.assignmentType,
      sharedGroupKey: params.sharedGroupKey,
      completedByUserId: null,
      completedAt: null,
      occurrenceKey: params.occurrenceKey,
      createdBy: params.actorId,
      updatedBy: params.actorId,
    });
    return assignmentRepo.save(row);
  }

  /**
   * Resolve a required schedule occurrence without duplicating open work or
   * resurrecting completed / manually cancelled rows.
   */
  private async resolveOrCreateOccurrence(
    assignmentRepo: any,
    params: {
      occurrenceKey: string;
      sharedGroupKey: string | null;
      templateId: number;
      templateVersionId: number;
      assigneeUserId: number | null;
      jobPositionId: number | null;
      dueAt: Date;
      assignmentType: AssignmentType;
      actorId: number | null;
    },
  ): Promise<DataCollectionAssignment> {
    const existing = await assignmentRepo.findOne({
      where: { occurrenceKey: params.occurrenceKey },
    });

    if (!existing) {
      return this.createAssignmentRow(assignmentRepo, params);
    }

    if (this.isOpenAssignmentStatus(existing.status)) {
      return existing;
    }

    if (existing.status === AssignmentStatus.COMPLETED) {
      // Occurrence already fulfilled — leave history intact.
      return existing;
    }

    if (this.canReactivateCancelled(existing)) {
      return this.reactivateAssignment(
        assignmentRepo,
        existing,
        params.actorId,
        params.sharedGroupKey,
        params.assignmentType,
      );
    }

    // Manual / republish cancelled — keep cancelled; use deterministic reopen key.
    const reopenKey = this.reopenOccurrenceKey(params.occurrenceKey);
    const reopenSharedGroupKey = params.sharedGroupKey
      ? this.reopenOccurrenceKey(params.sharedGroupKey)
      : null;
    const reopenExisting = await assignmentRepo.findOne({ where: { occurrenceKey: reopenKey } });

    if (!reopenExisting) {
      return this.createAssignmentRow(assignmentRepo, {
        ...params,
        occurrenceKey: reopenKey,
        sharedGroupKey: reopenSharedGroupKey,
      });
    }

    if (this.isOpenAssignmentStatus(reopenExisting.status)) {
      return reopenExisting;
    }

    if (reopenExisting.status === AssignmentStatus.COMPLETED) {
      return reopenExisting;
    }

    if (this.canReactivateCancelled(reopenExisting)) {
      return this.reactivateAssignment(
        assignmentRepo,
        reopenExisting,
        params.actorId,
        reopenSharedGroupKey,
        params.assignmentType,
      );
    }

    // Reopen slot itself was manually cancelled again — leave it; no further clones.
    return reopenExisting;
  }

  /**
   * Resolve active users that belong to the selected job positions via users.job_position_id.
   */
  private async resolveUsersByJobPositions(
    req: any,
    jobPositionIds: number[],
  ): Promise<Array<{ userId: number; jobPositionId: number }>> {
    if (!jobPositionIds.length) return [];
    try {
      const userRepo = req.tenantConnection.getRepository(User);
      const rows: Array<{ id: number; jobPositionId: number | string }> = await userRepo
        .createQueryBuilder('u')
        .select('u.id', 'id')
        .addSelect('u.job_position_id', 'jobPositionId')
        .where('u.job_position_id IN (:...jobPositionIds)', { jobPositionIds })
        .getRawMany();

      return rows
        .map((row) => ({
          userId: Number(row.id),
          jobPositionId: Number(row.jobPositionId),
        }))
        .filter((row) => Number.isFinite(row.userId) && Number.isFinite(row.jobPositionId));
    } catch (error) {
      this.logger.warn(
        `Failed to resolve users for job positions ${jobPositionIds.join(',')}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async markOverdue(req: any) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      // Compare against start of today so same-day (UTC midnight) dueAts stay open all day.
      const startOfToday = this.startOfDayUtc(new Date());

      const result = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.OVERDUE })
        .where('status IN (:...statuses)', {
          statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
        })
        .andWhere('due_at < :startOfToday', { startOfToday })
        .execute();

      // Heal rows marked overdue too early under the old due_at < now rule.
      const startedHealed = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.IN_PROGRESS })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere('due_at >= :startOfToday', { startOfToday })
        .andWhere('updated_at > created_at')
        .execute();

      const pendingHealed = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.PENDING })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere('due_at >= :startOfToday', { startOfToday })
        .execute();

      return {
        success: true,
        message: 'Overdue assignments updated',
        data: {
          affected: result.affected ?? 0,
          healed:
            (startedHealed.affected ?? 0) + (pendingHealed.affected ?? 0),
        },
      };
    } catch (error) {
      this.logger.error('markOverdue failed', error);
      throw new InternalServerErrorException('Failed to mark overdue assignments');
    }
  }

  /**
   * Cancel open future assignments when republishing (optionally excluding the new version).
   * Used so employees do not keep stale schedule rows from a previous version.
   */
  async cancelFutureForTemplate(req: any, templateId: number, fromVersionId?: number) {
    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const qb = repo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({
        status: AssignmentStatus.CANCELLED,
        cancelReason: AssignmentCancelReason.REPUBLISH,
      })
      .where('template_id = :templateId', { templateId })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          AssignmentStatus.PENDING,
          AssignmentStatus.IN_PROGRESS,
          AssignmentStatus.OVERDUE,
        ],
      })
      .andWhere('due_at >= :now', { now: new Date() });

    if (fromVersionId) {
      qb.andWhere('template_version_id != :versionId', { versionId: fromVersionId });
    }

    await qb.execute();
  }

  /**
   * Cancel every open assignment for a template (past + future).
   * Used when archiving / deleting so the form disappears from the employee portal.
   */
  async cancelOpenAssignmentsForTemplate(req: any, templateId: number) {
    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    await repo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({
        status: AssignmentStatus.CANCELLED,
        cancelReason: AssignmentCancelReason.TEMPLATE_ARCHIVED,
      })
      .where('template_id = :templateId', { templateId })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          AssignmentStatus.PENDING,
          AssignmentStatus.IN_PROGRESS,
          AssignmentStatus.OVERDUE,
        ],
      })
      .execute();
  }

  /** Ensure referenced users exist (best-effort). */
  async assertUsersExist(req: any, userIds: number[]) {
    if (!userIds.length) return;
    const userRepo = req.tenantConnection.getRepository(User);
    const found = await userRepo.find({ where: { id: In(userIds) }, select: ['id'] });
    const foundIds = new Set(found.map((u) => u.id));
    const missing = userIds.filter((id) => !foundIds.has(id));
    if (missing.length) {
      throw new BadRequestException(`Unknown user IDs in assign/report: ${missing.join(', ')}`);
    }
  }
}
