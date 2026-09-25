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
import { QueryAssignedFormsDto } from '../dto/assignments/query-assigned-forms.dto';
import { QueryAssignedFormDetailDto } from '../dto/assignments/query-assigned-form-detail.dto';
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
      .filter((s) =>
        [
          SubmissionStatus.SUBMITTED,
          SubmissionStatus.FLAGGED,
          SubmissionStatus.FAILED,
          SubmissionStatus.APPROVED,
        ].includes(s.status),
      )
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
    const mode = assignment.assignmentType || AssignmentType.INDIVIDUAL;
    const completion = buildAssignmentCompletion({
      status: assignment.status,
      assignmentType: mode,
      completedByUserId,
      completedAt,
      completedByName: options?.completedByName ?? null,
      viewerUserId: options?.viewerUserId ?? null,
    });

    // Expose `mode` only; drop legacy `assignmentType` from API payloads.
    const payload = {
      ...assignment,
      mode,
      formName,
      templateName: formName,
      submissionId: submissionPayload?.id ?? null,
      submission: submissionPayload,
      completion,
    };
    delete (payload as { assignmentType?: AssignmentType }).assignmentType;
    return payload;
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

  /**
   * Admin "Assigned Forms" list: summary cards + filterable/paginated table rows.
   * Recurring work is grouped by template + assignee (individual) or template (shared)
   * so yearly/monthly/daily series appear as one row with an `occurrences` summary.
   */
  async findAssignedForms(req: any, query: QueryAssignedFormsDto) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;
      const actorId = this.getActorId(req);
      const now = new Date();
      const wantRecent =
        query.recentSubmissions === true ||
        query.recentSubmissions === 'true' ||
        query.recentSubmissions === '1';
      const recentDays = Math.min(Math.max(1, query.recentDays ?? 7), 90);

      const buildBaseQb = () => {
        const qb = repo
          .createQueryBuilder('assignment')
          // Inner join so draft/archived/missing templates never leak into the board.
          .innerJoinAndSelect('assignment.template', 'template')
          .leftJoin(User, 'assignee', 'assignee.id = assignment.assigneeUserId');

        this.applyAssignedFormsActiveTemplateFilter(qb);

        // Exclude cancelled from the admin board unless explicitly requested.
        const statusFilter = this.resolveAssignedFormsStatus(query.status);
        if (statusFilter) {
          qb.andWhere('assignment.status = :status', { status: statusFilter });
        } else {
          qb.andWhere('assignment.status != :cancelledStatus', {
            cancelledStatus: AssignmentStatus.CANCELLED,
          });
        }

        this.applyAssignedFormsPeopleFilters(qb, query);
        this.applyAssignedFormsResponseStatusFilter(qb, query.responseStatus);

        const search = String(query.search || '').trim();
        if (search) {
          qb.andWhere(
            `(
              template.name ILIKE :search
              OR COALESCE(template.schema->>'formName', '') ILIKE :search
              OR COALESCE(assignee.name, '') ILIKE :search
              OR (
                assignment.sharedGroupKey IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM dc_assignments peer
                  INNER JOIN users peer_user ON peer_user.id = peer.assignee_user_id
                  WHERE peer.shared_group_key = assignment.shared_group_key
                    AND peer.deleted_at IS NULL
                    AND COALESCE(peer_user.name, '') ILIKE :search
                )
              )
            )`,
            { search: `%${search}%` },
          );
        }

        if (query.dueFrom) {
          const from = this.parseUtcDateOnly(query.dueFrom);
          if (!from) throw new BadRequestException('dueFrom must be a valid YYYY-MM-DD string');
          qb.andWhere('assignment.dueAt >= :dueFrom', { dueFrom: this.startOfDayUtc(from) });
        }
        if (query.dueTo) {
          const to = this.parseUtcDateOnly(query.dueTo);
          if (!to) throw new BadRequestException('dueTo must be a valid YYYY-MM-DD string');
          qb.andWhere('assignment.dueAt <= :dueTo', { dueTo: this.endOfDayUtc(to) });
        }

        if (wantRecent) {
          const since = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
          qb.andWhere(
            `EXISTS (
              SELECT 1 FROM dc_submissions s
              WHERE s.assignment_id = assignment.id
                AND s.status IN (:...finalizedStatuses)
                AND s.deleted_at IS NULL
                AND COALESCE(s.submitted_at, s.updated_at) >= :recentSince
            )`,
            {
              finalizedStatuses: [
                SubmissionStatus.SUBMITTED,
                SubmissionStatus.FLAGGED,
                SubmissionStatus.FAILED,
                SubmissionStatus.APPROVED,
              ],
              recentSince: since,
            },
          );
        }

        return qb;
      };

      // Load matching rows, then collapse recurring series before paginating.
      const rows: DataCollectionAssignment[] = (
        await buildBaseQb()
          .orderBy('assignment.dueAt', 'ASC')
          .addOrderBy('assignment.id', 'ASC')
          .getMany()
      ).filter((row) => this.isAssignedFormsActiveTemplate(row.template));

      const series = this.buildAssignedFormsSeries(rows, now);
      const total = series.length;
      const lastPage = Math.ceil(total / limit) || 1;
      const pageSeries = series.slice(skip, skip + limit);

      const [occurrenceStats, assignmentStats] = await Promise.all([
        this.loadAssignedFormsStats(req, query, now),
        this.loadAssignedFormsAssignmentStats(req, now),
      ]);
      const data = await this.serializeAssignedFormsSeries(req, pageSeries, actorId);

      return {
        success: true,
        /** Occurrence-level counts for the current list filters (do not mix with assignmentStats). */
        stats: { level: 'occurrence' as const, ...occurrenceStats },
        /**
         * Board summary cards — independent of table status/search/people filters.
         * `totalAssigned` = active templates; other fields = assignment-series progress.
         */
        assignmentStats,
        meta: { total, page, lastPage, limit },
        data,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Assigned forms list failed', error);
      throw new InternalServerErrorException('Failed to retrieve assigned forms');
    }
  }

  /** Series identity: one row per assignee×template (individual) or template (shared). */
  private assignedFormsSeriesKey(row: DataCollectionAssignment): string {
    const mode = row.assignmentType || AssignmentType.INDIVIDUAL;
    if (mode === AssignmentType.SHARED) {
      return `t:${row.templateId}:shared`;
    }
    if (row.assigneeUserId != null) {
      return `t:${row.templateId}:u:${row.assigneeUserId}`;
    }
    return `t:${row.templateId}:jp:${row.jobPositionId ?? 'none'}`;
  }

  /** Distinct occurrence id within a series — one row per due calendar day. */
  private assignedFormsOccurrenceId(row: DataCollectionAssignment): string {
    return `due:${new Date(row.dueAt).toISOString()}`;
  }

  private isOpenAssignedFormsStatus(status: AssignmentStatus): boolean {
    return (
      status === AssignmentStatus.PENDING ||
      status === AssignmentStatus.IN_PROGRESS ||
      status === AssignmentStatus.OVERDUE
    );
  }

  private buildAssignedFormsSeries(rows: DataCollectionAssignment[], now: Date) {
    const startOfToday = this.startOfDayUtc(now);
    type SeriesBucket = {
      key: string;
      templateId: number;
      mode: AssignmentType;
      assigneeUserId: number | null;
      rows: DataCollectionAssignment[];
      /** Distinct occurrence → representative row (shared: one row per sharedGroupKey). */
      occurrenceById: Map<string, DataCollectionAssignment>;
    };

    const buckets = new Map<string, SeriesBucket>();
    for (const row of rows) {
      const key = this.assignedFormsSeriesKey(row);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          key,
          templateId: row.templateId,
          mode: row.assignmentType || AssignmentType.INDIVIDUAL,
          assigneeUserId:
            (row.assignmentType || AssignmentType.INDIVIDUAL) === AssignmentType.SHARED
              ? null
              : row.assigneeUserId,
          rows: [],
          occurrenceById: new Map(),
        };
        buckets.set(key, bucket);
      }
      bucket.rows.push(row);
      const occurrenceId = this.assignedFormsOccurrenceId(row);
      // Prefer keeping an open / completed representative over a cancelled peer.
      const existing = bucket.occurrenceById.get(occurrenceId);
      if (!existing || this.occurrencePreferRank(row) < this.occurrencePreferRank(existing)) {
        bucket.occurrenceById.set(occurrenceId, row);
      }
    }

    const series = [...buckets.values()].map((bucket) => {
      const occurrenceRows = [...bucket.occurrenceById.values()];
      const progress = {
        total: occurrenceRows.length,
        completed: 0,
        inProgress: 0,
        overdue: 0,
        pending: 0,
        upcoming: 0,
        cancelled: 0,
      };

      for (const row of occurrenceRows) {
        switch (row.status) {
          case AssignmentStatus.COMPLETED:
            progress.completed += 1;
            break;
          case AssignmentStatus.IN_PROGRESS:
            progress.inProgress += 1;
            if (this.startOfDayUtc(row.dueAt).getTime() >= startOfToday.getTime()) {
              progress.upcoming += 1;
            }
            break;
          case AssignmentStatus.OVERDUE:
            progress.overdue += 1;
            break;
          case AssignmentStatus.PENDING:
            progress.pending += 1;
            if (this.startOfDayUtc(row.dueAt).getTime() >= startOfToday.getTime()) {
              progress.upcoming += 1;
            }
            break;
          case AssignmentStatus.CANCELLED:
            progress.cancelled += 1;
            break;
          default:
            break;
        }
      }

      const openRows = occurrenceRows.filter((row) => this.isOpenAssignedFormsStatus(row.status));
      const upcomingRows = openRows.filter(
        (row) => this.startOfDayUtc(row.dueAt).getTime() >= startOfToday.getTime(),
      );
      const overdueRows = openRows.filter(
        (row) => this.startOfDayUtc(row.dueAt).getTime() < startOfToday.getTime(),
      );

      const pickEarliest = (list: DataCollectionAssignment[]) =>
        [...list].sort((a, b) => {
          const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          return dueDiff !== 0 ? dueDiff : a.id - b.id;
        })[0];

      const representative =
        pickEarliest(upcomingRows) ||
        pickEarliest(overdueRows) ||
        pickEarliest(occurrenceRows) ||
        bucket.rows[0];

      const dueTimes = occurrenceRows.map((row) => new Date(row.dueAt).getTime());
      const startDate = dueTimes.length ? new Date(Math.min(...dueTimes)) : null;
      const endDate = dueTimes.length ? new Date(Math.max(...dueTimes)) : null;

      const openCount = progress.pending + progress.inProgress + progress.overdue;
      const occurrenceCount = openCount > 0 ? openCount : progress.completed;
      const occurrencesLabel =
        openCount > 0 ? `${openCount} upcoming` : `${progress.completed} completed`;

      return {
        key: bucket.key,
        templateId: bucket.templateId,
        mode: bucket.mode,
        assigneeUserId: bucket.assigneeUserId,
        rows: bucket.rows,
        occurrenceRows,
        representative,
        progress,
        startDate,
        endDate,
        occurrenceCount,
        occurrencesLabel,
        nextDueAt: representative?.dueAt ?? null,
      };
    });

    series.sort((a, b) => {
      const aCreated = Math.max(...a.rows.map((r) => new Date(r.createdAt).getTime()));
      const bCreated = Math.max(...b.rows.map((r) => new Date(r.createdAt).getTime()));
      if (bCreated !== aCreated) return bCreated - aCreated;
      return (b.representative?.id || 0) - (a.representative?.id || 0);
    });

    return series;
  }

  /** Lower rank = preferred representative for a same-due occurrence. */
  private occurrencePreferRank(row: DataCollectionAssignment): number {
    switch (row.status) {
      case AssignmentStatus.COMPLETED: {
        // Prefer the peer who actually submitted (submission lives on their row).
        if (
          row.completedByUserId != null &&
          row.assigneeUserId != null &&
          Number(row.completedByUserId) === Number(row.assigneeUserId)
        ) {
          return -1;
        }
        return 0;
      }
      case AssignmentStatus.IN_PROGRESS:
        return 1;
      case AssignmentStatus.OVERDUE:
        return 2;
      case AssignmentStatus.PENDING:
        return 3;
      case AssignmentStatus.CANCELLED:
        return 9;
      default:
        return 5;
    }
  }

  /** True when the template would appear on Forms Templates → Active. */
  private isAssignedFormsActiveTemplate(
    template?: DataCollectionTemplate | null,
  ): boolean {
    return Boolean(
      template &&
        !template.deletedAt &&
        template.isActive === true &&
        template.status === TemplateStatus.ACTIVE,
    );
  }

  /** Restrict Assigned Forms queries to published, non-deleted templates. */
  private applyAssignedFormsActiveTemplateFilter(qb: any): void {
    qb.andWhere('template.status = :assignedFormsTemplateStatus', {
      assignedFormsTemplateStatus: TemplateStatus.ACTIVE,
    }).andWhere('template.is_active = :assignedFormsTemplateIsActive', {
      assignedFormsTemplateIsActive: true,
    });
  }

  /** Resolve `userId[]` + legacy `assigneeUserId` into a unique id list. */
  private resolveAssignedFormsUserIds(query: QueryAssignedFormsDto): number[] {
    const ids = new Set<number>();
    for (const id of query.userId || []) {
      if (Number.isFinite(id)) ids.add(Number(id));
    }
    if (query.assigneeUserId != null && Number.isFinite(Number(query.assigneeUserId))) {
      ids.add(Number(query.assigneeUserId));
    }
    return [...ids];
  }

  private resolveAssignedFormsJobPositionIds(query: QueryAssignedFormsDto): number[] {
    return [...new Set((query.jobPositionId || []).map(Number).filter(Number.isFinite))];
  }

  /**
   * Filter by assignee user(s) and/or job position(s).
   * Users: row assignee or any shared-group peer.
   * Job positions: assignment.jobPositionId, assignee's current JP, or shared peer JP.
   */
  private applyAssignedFormsPeopleFilters(qb: any, query: QueryAssignedFormsDto): void {
    const userIds = this.resolveAssignedFormsUserIds(query);
    if (userIds.length) {
      qb.andWhere(
        `(
          assignment.assigneeUserId IN (:...assignedFormsUserIds)
          OR (
            assignment.sharedGroupKey IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM dc_assignments peer
              WHERE peer.shared_group_key = assignment.shared_group_key
                AND peer.assignee_user_id IN (:...assignedFormsUserIds)
                AND peer.deleted_at IS NULL
            )
          )
        )`,
        { assignedFormsUserIds: userIds },
      );
    }

    const jobPositionIds = this.resolveAssignedFormsJobPositionIds(query);
    if (jobPositionIds.length) {
      qb.andWhere(
        `(
          assignment.jobPositionId IN (:...assignedFormsJobPositionIds)
          OR assignee.job_position_id IN (:...assignedFormsJobPositionIds)
          OR (
            assignment.sharedGroupKey IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM dc_assignments peer
              LEFT JOIN users peer_user ON peer_user.id = peer.assignee_user_id
              WHERE peer.shared_group_key = assignment.shared_group_key
                AND peer.deleted_at IS NULL
                AND (
                  peer.job_position_id IN (:...assignedFormsJobPositionIds)
                  OR peer_user.job_position_id IN (:...assignedFormsJobPositionIds)
                )
            )
          )
        )`,
        { assignedFormsJobPositionIds: jobPositionIds },
      );
    }
  }

  /**
   * Filter assignments that have a non-deleted submission in one of the given
   * review statuses (submitted | flagged | failed | approved).
   * Independent of assignment workflow `status`.
   */
  private applyAssignedFormsResponseStatusFilter(
    qb: any,
    responseStatus?: SubmissionStatus[] | string[] | null,
  ): void {
    const statuses = [
      ...new Set(
        (responseStatus || [])
          .map((item) => String(item).toLowerCase())
          .filter((item): item is SubmissionStatus =>
            [
              SubmissionStatus.SUBMITTED,
              SubmissionStatus.FLAGGED,
              SubmissionStatus.FAILED,
              SubmissionStatus.APPROVED,
            ].includes(item as SubmissionStatus),
          ),
      ),
    ];
    if (!statuses.length) return;

    qb.andWhere(
      `EXISTS (
        SELECT 1 FROM dc_submissions response_sub
        WHERE response_sub.assignment_id = assignment.id
          AND response_sub.status IN (:...assignedFormsResponseStatuses)
          AND response_sub.deleted_at IS NULL
      )`,
      { assignedFormsResponseStatuses: statuses },
    );
  }

  private resolveAssignedFormsStatus(
    status?: string | null,
  ): AssignmentStatus | null {
    if (!status) return null;
    if (status === 'not_started') return AssignmentStatus.PENDING;
    return status as AssignmentStatus;
  }

  private formatDueDateLabel(dueAt: Date, options?: { includeTime?: boolean }): string {
    const value = dueAt instanceof Date ? dueAt : new Date(dueAt);
    const datePart = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(value);

    const includeTime = options?.includeTime !== false;
    if (includeTime && this.frequencyService.hasClockTime(value)) {
      return `${datePart}, ${this.frequencyService.formatTimeAmPm(
        value.getUTCHours(),
        value.getUTCMinutes(),
      )}`;
    }
    return datePart;
  }

  private statusLabel(status: AssignmentStatus): string {
    switch (status) {
      case AssignmentStatus.PENDING:
        return 'Not Started';
      case AssignmentStatus.IN_PROGRESS:
        return 'In Progress';
      case AssignmentStatus.COMPLETED:
        return 'Completed';
      case AssignmentStatus.OVERDUE:
        return 'Overdue';
      case AssignmentStatus.CANCELLED:
        return 'Cancelled';
      default:
        return String(status);
    }
  }

  /**
   * Stable board cards for Assigned Forms.
   * - totalAssigned: count of active (published) templates
   * - withOverdue / withInProgress / fullyCompleted: from all open assignment series
   *   (ignores table filters so status=completed does not shrink the other cards)
   */
  private async loadAssignedFormsAssignmentStats(req: any, now: Date) {
    const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);

    const totalAssigned = await templateRepo.count({
      where: {
        status: TemplateStatus.ACTIVE,
        isActive: true,
      },
    });

    const boardRows: DataCollectionAssignment[] = (
      await assignmentRepo
        .createQueryBuilder('assignment')
        .innerJoinAndSelect('assignment.template', 'template')
        .andWhere('assignment.status != :cancelledStatus', {
          cancelledStatus: AssignmentStatus.CANCELLED,
        })
        .andWhere('template.status = :templateStatus', {
          templateStatus: TemplateStatus.ACTIVE,
        })
        .andWhere('template.is_active = :templateIsActive', {
          templateIsActive: true,
        })
        .getMany()
    ).filter((row) => this.isAssignedFormsActiveTemplate(row.template));

    const series = this.buildAssignedFormsSeries(boardRows, now);

    return {
      level: 'assignment' as const,
      totalAssigned,
      withOverdue: series.filter((item) => item.progress.overdue > 0).length,
      withInProgress: series.filter((item) => item.progress.inProgress > 0).length,
      fullyCompleted: series.filter(
        (item) =>
          item.progress.total > 0 &&
          item.progress.completed === item.progress.total &&
          item.progress.overdue === 0 &&
          item.progress.inProgress === 0 &&
          item.progress.pending === 0,
      ).length,
    };
  }

  private async loadAssignedFormsStats(
    req: any,
    query: QueryAssignedFormsDto,
    now: Date,
  ) {
    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const wantRecent =
      query.recentSubmissions === true ||
      query.recentSubmissions === 'true' ||
      query.recentSubmissions === '1';
    const recentDays = Math.min(Math.max(1, query.recentDays ?? 7), 90);

    const qb = repo
      .createQueryBuilder('assignment')
      .innerJoin('assignment.template', 'template')
      .leftJoin(User, 'assignee', 'assignee.id = assignment.assigneeUserId')
      .select('assignment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .andWhere('assignment.status != :cancelledStatus', {
        cancelledStatus: AssignmentStatus.CANCELLED,
      });

    this.applyAssignedFormsActiveTemplateFilter(qb);
    this.applyAssignedFormsPeopleFilters(qb, query);
    this.applyAssignedFormsResponseStatusFilter(qb, query.responseStatus);

    const search = String(query.search || '').trim();
    if (search) {
      qb.andWhere(
        `(
          template.name ILIKE :search
          OR COALESCE(template.schema->>'formName', '') ILIKE :search
          OR COALESCE(assignee.name, '') ILIKE :search
          OR (
            assignment.sharedGroupKey IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM dc_assignments peer
              INNER JOIN users peer_user ON peer_user.id = peer.assignee_user_id
              WHERE peer.shared_group_key = assignment.shared_group_key
                AND peer.deleted_at IS NULL
                AND COALESCE(peer_user.name, '') ILIKE :search
            )
          )
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.dueFrom) {
      const from = this.parseUtcDateOnly(query.dueFrom);
      if (!from) throw new BadRequestException('dueFrom must be a valid YYYY-MM-DD string');
      qb.andWhere('assignment.dueAt >= :dueFrom', { dueFrom: this.startOfDayUtc(from) });
    }
    if (query.dueTo) {
      const to = this.parseUtcDateOnly(query.dueTo);
      if (!to) throw new BadRequestException('dueTo must be a valid YYYY-MM-DD string');
      qb.andWhere('assignment.dueAt <= :dueTo', { dueTo: this.endOfDayUtc(to) });
    }

    if (wantRecent) {
      const since = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM dc_submissions s
          WHERE s.assignment_id = assignment.id
            AND s.status IN (:...finalizedStatuses)
            AND s.deleted_at IS NULL
            AND COALESCE(s.submitted_at, s.updated_at) >= :recentSince
        )`,
        {
          finalizedStatuses: [
            SubmissionStatus.SUBMITTED,
            SubmissionStatus.FLAGGED,
            SubmissionStatus.FAILED,
            SubmissionStatus.APPROVED,
          ],
          recentSince: since,
        },
      );
    }

    qb.groupBy('assignment.status');
    const rows: Array<{ status: AssignmentStatus; count: string }> = await qb.getRawMany();

    const counts: Record<string, number> = {
      [AssignmentStatus.PENDING]: 0,
      [AssignmentStatus.IN_PROGRESS]: 0,
      [AssignmentStatus.COMPLETED]: 0,
      [AssignmentStatus.OVERDUE]: 0,
    };
    for (const row of rows) {
      counts[row.status] = Number(row.count) || 0;
    }

    const totalAssigned =
      (counts[AssignmentStatus.PENDING] || 0) +
      (counts[AssignmentStatus.IN_PROGRESS] || 0) +
      (counts[AssignmentStatus.COMPLETED] || 0) +
      (counts[AssignmentStatus.OVERDUE] || 0);

    return {
      totalAssigned,
      completed: counts[AssignmentStatus.COMPLETED] || 0,
      inProgress: counts[AssignmentStatus.IN_PROGRESS] || 0,
      overdue: counts[AssignmentStatus.OVERDUE] || 0,
      notStarted: counts[AssignmentStatus.PENDING] || 0,
    };
  }

  private async loadSharedGroupAssigneeIds(
    req: any,
    sharedGroupKeys: string[],
  ): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    const keys = [...new Set(sharedGroupKeys.filter((k) => !!k))];
    if (!keys.length) return map;

    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const peers: DataCollectionAssignment[] = await repo.find({
      where: { sharedGroupKey: In(keys) },
      select: ['id', 'sharedGroupKey', 'assigneeUserId'],
    });

    for (const peer of peers) {
      if (!peer.sharedGroupKey || peer.assigneeUserId == null) continue;
      const list = map.get(peer.sharedGroupKey) || [];
      if (!list.includes(peer.assigneeUserId)) list.push(peer.assigneeUserId);
      map.set(peer.sharedGroupKey, list);
    }
    return map;
  }

  /** Peer assignment ids keyed by sharedGroupKey (for shared submission lookup). */
  private async loadSharedGroupAssignmentIds(
    req: any,
    sharedGroupKeys: string[],
  ): Promise<Map<string, number[]>> {
    const map = new Map<string, number[]>();
    const keys = [...new Set(sharedGroupKeys.filter((k) => !!k))];
    if (!keys.length) return map;

    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const peers: DataCollectionAssignment[] = await repo.find({
      where: { sharedGroupKey: In(keys) },
      select: ['id', 'sharedGroupKey'],
    });

    for (const peer of peers) {
      if (!peer.sharedGroupKey || peer.id == null) continue;
      const list = map.get(peer.sharedGroupKey) || [];
      if (!list.includes(peer.id)) list.push(peer.id);
      map.set(peer.sharedGroupKey, list);
    }
    return map;
  }

  /**
   * Map each occurrence row → its submission.
   * Shared mode: submission is stored on the submitter's assignment id; resolve via peers.
   */
  private async loadSubmissionsForOccurrenceRows(
    req: any,
    rows: DataCollectionAssignment[],
  ): Promise<Map<number, DataCollectionSubmission>> {
    const byRowId = new Map<number, DataCollectionSubmission>();
    if (!rows.length) return byRowId;

    const sharedKeys = [
      ...new Set(
        rows
          .map((row) => row.sharedGroupKey)
          .filter((key): key is string => !!key),
      ),
    ];
    const peerIdsByKey = await this.loadSharedGroupAssignmentIds(req, sharedKeys);

    const assignmentIds = [
      ...new Set([
        ...rows.map((row) => row.id),
        ...[...peerIdsByKey.values()].flat(),
      ]),
    ];
    const byAssignmentId = await this.loadSubmissionsByAssignmentIds(req, assignmentIds);

    const unresolvedShared: DataCollectionAssignment[] = [];
    for (const row of rows) {
      let submission = byAssignmentId.get(row.id) || null;
      if (!submission && row.sharedGroupKey) {
        for (const peerId of peerIdsByKey.get(row.sharedGroupKey) || []) {
          submission = byAssignmentId.get(peerId) || null;
          if (submission) break;
        }
      }
      if (submission) {
        byRowId.set(row.id, submission);
      } else if ((row.assignmentType || AssignmentType.INDIVIDUAL) === AssignmentType.SHARED) {
        unresolvedShared.push(row);
      }
    }

    if (unresolvedShared.length) {
      const fallbackByDue = await this.loadSharedSubmissionsByTemplateDue(req, unresolvedShared);
      for (const row of unresolvedShared) {
        const key = `${row.templateId}:${new Date(row.dueAt).toISOString()}`;
        const submission = fallbackByDue.get(key);
        if (submission) byRowId.set(row.id, submission);
      }
    }

    return byRowId;
  }

  /**
   * Fallback when sharedGroupKey drifted across versions: find a finalized
   * submission on any COMPLETED peer for the same template + due day.
   */
  private async loadSharedSubmissionsByTemplateDue(
    req: any,
    rows: DataCollectionAssignment[],
  ): Promise<Map<string, DataCollectionSubmission>> {
    const result = new Map<string, DataCollectionSubmission>();
    if (!rows.length) return result;

    const templateIds = [...new Set(rows.map((row) => row.templateId))];
    const dueAts = [...new Set(rows.map((row) => new Date(row.dueAt).toISOString()))].map(
      (iso) => new Date(iso),
    );

    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const peers: DataCollectionAssignment[] = await assignmentRepo.find({
      where: {
        templateId: In(templateIds),
        dueAt: In(dueAts),
        status: AssignmentStatus.COMPLETED,
      },
      select: ['id', 'templateId', 'dueAt'],
    });
    if (!peers.length) return result;

    const byAssignmentId = await this.loadSubmissionsByAssignmentIds(
      req,
      peers.map((peer) => peer.id),
    );

    for (const peer of peers) {
      const submission = byAssignmentId.get(peer.id);
      if (!submission) continue;
      const key = `${peer.templateId}:${new Date(peer.dueAt).toISOString()}`;
      if (!result.has(key)) result.set(key, submission);
    }
    return result;
  }

  private async loadTemplateVersionsByIds(
    req: any,
    versionIds: number[],
  ): Promise<Map<number, TemplateVersion>> {
    const map = new Map<number, TemplateVersion>();
    const uniqueIds = [...new Set(versionIds.filter((id) => Number.isFinite(id)))];
    if (!uniqueIds.length) return map;

    const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
    const versions: TemplateVersion[] = await versionRepo.find({
      where: { id: In(uniqueIds) },
    });
    for (const version of versions) {
      map.set(version.id, version);
    }
    return map;
  }

  private serializeAssignedFormsSubmission(
    submission: DataCollectionSubmission | null | undefined,
    assignment: DataCollectionAssignment,
    version?: TemplateVersion | null,
  ) {
    if (!submission) return null;

    const template = assignment.template;
    const schema = (version?.schemaSnapshot ?? template?.schema ?? null) as Record<
      string,
      any
    > | null;
    const formName = this.resolveFormName(
      template
        ? ({ name: template.name, schema } as DataCollectionTemplate)
        : null,
    );

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
      templateId: template?.id ?? version?.templateId ?? assignment.templateId ?? null,
      templateName: formName,
      formName,
      /** Pinned version schema (fallback: live template schema) so answers can be matched to fields. */
      template: template
        ? {
            id: template.id,
            name: template.name,
            schema,
            status: template.status,
            isActive: template.isActive,
          }
        : version
          ? {
              id: version.templateId,
              name: formName,
              schema,
              status: null,
              isActive: null,
            }
          : null,
    };
  }

  private async serializeAssignedFormsSeries(
    req: any,
    series: Array<{
      key: string;
      templateId: number;
      mode: AssignmentType;
      assigneeUserId: number | null;
      rows: DataCollectionAssignment[];
      occurrenceRows: DataCollectionAssignment[];
      representative: DataCollectionAssignment;
      progress: {
        total: number;
        completed: number;
        inProgress: number;
        overdue: number;
        pending: number;
        upcoming: number;
        cancelled: number;
      };
      startDate: Date | null;
      endDate: Date | null;
      occurrenceCount: number;
      occurrencesLabel: string;
      nextDueAt: Date | null;
    }>,
    _viewerUserId: number | null,
  ) {
    const sharedGroupKeys = [
      ...new Set(
        series.flatMap((item) =>
          item.rows
            .map((row) => row.sharedGroupKey)
            .filter((key): key is string => !!key),
        ),
      ),
    ];
    const sharedAssigneesByKey = await this.loadSharedGroupAssigneeIds(req, sharedGroupKeys);

    const assigneeIds = new Set<number>();
    for (const item of series) {
      if (item.mode === AssignmentType.SHARED) {
        for (const row of item.rows) {
          if (row.assigneeUserId != null) assigneeIds.add(row.assigneeUserId);
          if (row.sharedGroupKey) {
            for (const id of sharedAssigneesByKey.get(row.sharedGroupKey) || []) {
              assigneeIds.add(id);
            }
          }
        }
      } else if (item.assigneeUserId != null) {
        assigneeIds.add(item.assigneeUserId);
      }
    }

    const namesById = await this.loadUserNamesByIds(req, [...assigneeIds]);

    return series.map((item) => {
      const row = item.representative;
      const mode = item.mode;
      const formName = this.resolveFormName(row.template);

      let groupIds: number[] = [];
      if (mode === AssignmentType.SHARED) {
        const ids = new Set<number>();
        for (const seriesRow of item.rows) {
          if (seriesRow.assigneeUserId != null) ids.add(seriesRow.assigneeUserId);
          if (seriesRow.sharedGroupKey) {
            for (const id of sharedAssigneesByKey.get(seriesRow.sharedGroupKey) || []) {
              ids.add(id);
            }
          }
        }
        groupIds = [...ids];
      } else if (item.assigneeUserId != null) {
        groupIds = [item.assigneeUserId];
      }

      const assignedTo = groupIds.map((id) => ({
        id,
        name: namesById.get(id) || `User #${id}`,
      }));

      const frequency = (row.template?.schema as Record<string, any> | null | undefined)?.frequency;
      const frequencyLabel = this.frequencyService.formatFrequencyLabel(frequency);
      const nextDueAt = item.nextDueAt ?? row.dueAt;
      const startDate = item.startDate;
      const endDate = item.endDate;

      return {
        id: row.id,
        seriesKey: item.key,
        templateId: row.templateId,
        templateVersionId: row.templateVersionId,
        formName,
        assigneeUserId: item.assigneeUserId ?? row.assigneeUserId,
        assigneeUserIds: groupIds,
        assignedTo,
        frequency,
        frequencyLabel,
        startDate,
        startDateLabel: startDate ? this.formatDueDateLabel(startDate, { includeTime: false }) : null,
        endDate,
        endDateLabel: endDate ? this.formatDueDateLabel(endDate, { includeTime: false }) : null,
        periodLabel:
          startDate && endDate
            ? `${this.formatDueDateLabel(startDate, { includeTime: false })} → ${this.formatDueDateLabel(endDate, { includeTime: false })}`
            : null,
        dueAt: nextDueAt,
        dueDateLabel: this.formatDueDateLabel(nextDueAt),
        nextDueAt,
        nextDueLabel: this.formatDueDateLabel(nextDueAt),
        status: row.status,
        statusLabel: this.statusLabel(row.status),
        mode,
        sharedGroupKey: row.sharedGroupKey,
        /** Occurrence-level progress for this assignment series. */
        progress: {
          total: item.progress.total,
          completed: item.progress.completed,
          inProgress: item.progress.inProgress,
          overdue: item.progress.overdue,
          pending: item.progress.pending,
          upcoming: item.progress.upcoming,
        },
        completed: item.progress.completed,
        inProgress: item.progress.inProgress,
        overdue: item.progress.overdue,
        occurrenceCount: item.occurrenceCount,
        occurrences: {
          count: item.occurrenceCount,
          label: item.occurrencesLabel,
        },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  /**
   * Single View Details payload for an assignment series.
   * Resolve series from any occurrence `assignmentId` on the listing row.
   * Occurrences default to the current UTC month (paginated + status filters).
   */
  async findAssignedFormDetail(
    req: any,
    assignmentId: number,
    query: QueryAssignedFormDetailDto,
  ) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const seed = await repo.findOne({
        where: { id: assignmentId },
        relations: ['template'],
      });
      if (!seed) {
        throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
      }

      const seriesKey = this.assignedFormsSeriesKey(seed);
      const mode = seed.assignmentType || AssignmentType.INDIVIDUAL;
      const now = new Date();
      const actorId = this.getActorId(req);

      const seriesQb = repo
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.template', 'template')
        .andWhere('assignment.templateId = :templateId', { templateId: seed.templateId })
        .andWhere('assignment.status != :cancelledStatus', {
          cancelledStatus: AssignmentStatus.CANCELLED,
        });

      if (mode === AssignmentType.SHARED) {
        seriesQb.andWhere('assignment.assignmentType = :shared', {
          shared: AssignmentType.SHARED,
        });
      } else if (seed.assigneeUserId != null) {
        seriesQb
          .andWhere('assignment.assignmentType = :individual', {
            individual: AssignmentType.INDIVIDUAL,
          })
          .andWhere('assignment.assigneeUserId = :assigneeUserId', {
            assigneeUserId: seed.assigneeUserId,
          });
      } else {
        seriesQb
          .andWhere('assignment.assignmentType = :individual', {
            individual: AssignmentType.INDIVIDUAL,
          })
          .andWhere('assignment.jobPositionId = :jobPositionId', {
            jobPositionId: seed.jobPositionId,
          });
      }

      const seriesRows: DataCollectionAssignment[] = await seriesQb
        .orderBy('assignment.dueAt', 'ASC')
        .addOrderBy('assignment.id', 'ASC')
        .getMany();

      if (!seriesRows.length) {
        throw new NotFoundException(`Assignment series not found for ID ${assignmentId}`);
      }

      const seriesList = this.buildAssignedFormsSeries(seriesRows, now);
      const series = seriesList.find((item) => item.key === seriesKey) || seriesList[0];
      if (!series) {
        throw new NotFoundException(`Assignment series not found for ID ${assignmentId}`);
      }

      const [assignmentSummary] = await this.serializeAssignedFormsSeries(req, [series], actorId);

      const occurrenceStatus = this.resolveAssignedFormOccurrenceStatus(query.status, now);
      const hasExplicitDueRange = Boolean(
        query.date || query.month || query.dueFrom || query.dueTo,
      );
      const dueRange = this.resolveAssignedFormDetailDueRange(query);
      const defaultOccurrenceList =
        !hasExplicitDueRange &&
        !occurrenceStatus.upcomingOnly &&
        (!query.status || query.status === 'all');

      let filteredOccurrences = [...series.occurrenceRows];
      if (dueRange) {
        filteredOccurrences = filteredOccurrences.filter((row) => {
          const due = new Date(row.dueAt).getTime();
          return due >= dueRange.start.getTime() && due <= dueRange.end.getTime();
        });
      }
      if (occurrenceStatus.statuses) {
        filteredOccurrences = filteredOccurrences.filter((row) =>
          occurrenceStatus.statuses!.includes(row.status),
        );
      }
      if (occurrenceStatus.upcomingOnly) {
        const startOfToday = this.startOfDayUtc(now).getTime();
        filteredOccurrences = filteredOccurrences.filter(
          (row) =>
            (row.status === AssignmentStatus.PENDING ||
              row.status === AssignmentStatus.IN_PROGRESS) &&
            this.startOfDayUtc(row.dueAt).getTime() >= startOfToday,
        );
      }

      // Default: overdue + completed + in_progress (all) + only the next 1 upcoming.
      if (defaultOccurrenceList) {
        const startOfToday = this.startOfDayUtc(now).getTime();
        const nextUpcoming = [...filteredOccurrences]
          .filter(
            (row) =>
              (row.status === AssignmentStatus.PENDING ||
                row.status === AssignmentStatus.IN_PROGRESS) &&
              this.startOfDayUtc(row.dueAt).getTime() >= startOfToday,
          )
          .sort((a, b) => {
            const dueDiff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
            return dueDiff !== 0 ? dueDiff : a.id - b.id;
          })[0];

        filteredOccurrences = filteredOccurrences.filter((row) => {
          if (row.status === AssignmentStatus.OVERDUE) return true;
          if (row.status === AssignmentStatus.COMPLETED) return true;
          if (row.status === AssignmentStatus.IN_PROGRESS) {
            // Past/open in-progress always; future in-progress only if it is the next upcoming.
            if (this.startOfDayUtc(row.dueAt).getTime() < startOfToday) return true;
            return nextUpcoming != null && row.id === nextUpcoming.id;
          }
          if (row.status === AssignmentStatus.PENDING) {
            // Past pending (should usually be overdue) + the single next upcoming.
            if (this.startOfDayUtc(row.dueAt).getTime() < startOfToday) return true;
            return nextUpcoming != null && row.id === nextUpcoming.id;
          }
          return false;
        });
      }

      const responseStatuses = [
        ...new Set(
          (query.responseStatus || [])
            .map((item) => String(item).toLowerCase())
            .filter((item): item is SubmissionStatus =>
              [
                SubmissionStatus.SUBMITTED,
                SubmissionStatus.FLAGGED,
                SubmissionStatus.FAILED,
                SubmissionStatus.APPROVED,
              ].includes(item as SubmissionStatus),
            ),
        ),
      ];
      if (responseStatuses.length) {
        const submissionsByAssignment = await this.loadSubmissionsByAssignmentIds(
          req,
          filteredOccurrences.map((row) => row.id),
        );
        filteredOccurrences = filteredOccurrences.filter((row) => {
          const submission = submissionsByAssignment.get(row.id);
          return submission != null && responseStatuses.includes(submission.status);
        });
      }

      // Upcoming-only lists: nearest first. Default + history: newest first.
      filteredOccurrences.sort((a, b) => {
        const dueDiff = occurrenceStatus.upcomingOnly
          ? new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
          : new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
        return dueDiff !== 0 ? dueDiff : b.id - a.id;
      });

      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 31), 100);
      const skip = (page - 1) * limit;
      const total = filteredOccurrences.length;
      const lastPage = Math.ceil(total / limit) || 1;
      const pageRows = filteredOccurrences.slice(skip, skip + limit);

      const occurrences = await this.serializeAssignedFormOccurrences(req, pageRows, actorId);

      const startOfTodayIso = this.startOfDayUtc(now).toISOString().slice(0, 10);
      const nextUpcomingInList = defaultOccurrenceList
        ? filteredOccurrences.find(
            (row) =>
              (row.status === AssignmentStatus.PENDING ||
                row.status === AssignmentStatus.IN_PROGRESS) &&
              this.startOfDayUtc(row.dueAt).getTime() >= this.startOfDayUtc(now).getTime(),
          )
        : null;
      const metaDueFrom =
        dueRange?.start.toISOString().slice(0, 10) ??
        (occurrenceStatus.upcomingOnly || defaultOccurrenceList
          ? series.startDate
            ? this.startOfDayUtc(series.startDate).toISOString().slice(0, 10)
            : startOfTodayIso
          : null);
      const metaDueTo =
        dueRange?.end.toISOString().slice(0, 10) ??
        (occurrenceStatus.upcomingOnly && series.endDate
          ? this.startOfDayUtc(series.endDate).toISOString().slice(0, 10)
          : nextUpcomingInList
            ? this.startOfDayUtc(nextUpcomingInList.dueAt).toISOString().slice(0, 10)
            : defaultOccurrenceList
              ? startOfTodayIso
              : null);

      return {
        success: true,
        data: {
          assignment: {
            ...assignmentSummary,
            seriesKey,
            summary: {
              formName: assignmentSummary.formName,
              assignedTo: assignmentSummary.assignedTo,
              frequencyLabel: assignmentSummary.frequencyLabel,
              periodLabel: assignmentSummary.periodLabel,
              startDate: assignmentSummary.startDate,
              endDate: assignmentSummary.endDate,
              totalOccurrences: series.progress.total,
              completed: series.progress.completed,
              inProgress: series.progress.inProgress,
              overdue: series.progress.overdue,
              upcoming: series.progress.upcoming,
              pending: series.progress.pending,
            },
          },
          occurrences: {
            meta: {
              total,
              page,
              lastPage,
              limit,
              month: dueRange?.month ?? null,
              date: dueRange?.date ?? null,
              dueFrom: metaDueFrom,
              dueTo: metaDueTo,
              status: query.status || 'all',
              responseStatus: responseStatuses.length ? responseStatuses : null,
            },
            data: occurrences,
          },
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error('Assigned form detail failed', error);
      throw new InternalServerErrorException('Failed to retrieve assigned form details');
    }
  }

  private resolveAssignedFormDetailDueRange(
    query: {
      month?: string;
      date?: string;
      dueFrom?: string;
      dueTo?: string;
    },
  ): { start: Date; end: Date; month: string | null; date: string | null } | null {
    // Single calendar day (UI date picker).
    if (query.date) {
      const day = this.parseUtcDateOnly(query.date);
      if (!day) throw new BadRequestException('date must be a valid YYYY-MM-DD string');
      return {
        start: this.startOfDayUtc(day),
        end: this.endOfDayUtc(day),
        month: null,
        date: query.date,
      };
    }

    if (query.dueFrom || query.dueTo) {
      if (!query.dueFrom || !query.dueTo) {
        throw new BadRequestException('dueFrom and dueTo must both be provided');
      }
      const from = this.parseUtcDateOnly(query.dueFrom);
      const to = this.parseUtcDateOnly(query.dueTo);
      if (!from || !to) {
        throw new BadRequestException('dueFrom/dueTo must be valid YYYY-MM-DD strings');
      }
      return {
        start: this.startOfDayUtc(from),
        end: this.endOfDayUtc(to),
        month: null,
        date: null,
      };
    }

    // Explicit month from UI calendar.
    if (query.month) {
      const match = /^(\d{4})-(\d{2})$/.exec(query.month);
      if (!match) throw new BadRequestException('month must be a valid YYYY-MM string');
      const year = Number(match[1]);
      const monthIndex = Number(match[2]) - 1;
      if (monthIndex < 0 || monthIndex > 11) {
        throw new BadRequestException('month must be a valid YYYY-MM string');
      }
      const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
      return { start, end, month: query.month, date: null };
    }

    // No explicit range: caller applies default (next 1 upcoming) or status=upcoming (all).
    return null;
  }

  private resolveAssignedFormOccurrenceStatus(
    status: string | undefined,
    _now: Date,
  ): { statuses: AssignmentStatus[] | null; upcomingOnly: boolean } {
    if (!status || status === 'all') {
      return { statuses: null, upcomingOnly: false };
    }
    if (status === 'upcoming') {
      return { statuses: null, upcomingOnly: true };
    }
    if (status === 'not_started') {
      return { statuses: [AssignmentStatus.PENDING], upcomingOnly: false };
    }
    return { statuses: [status as AssignmentStatus], upcomingOnly: false };
  }

  private async serializeAssignedFormOccurrences(
    req: any,
    rows: DataCollectionAssignment[],
    viewerUserId: number | null,
  ) {
    const submissionsByAssignment = await this.loadSubmissionsForOccurrenceRows(req, rows);

    const completedByIds = rows
      .map((row) => {
        const submission = submissionsByAssignment.get(row.id);
        return row.completedByUserId ?? submission?.submittedBy ?? null;
      })
      .filter((id): id is number => id != null && Number.isFinite(id));

    const assigneeIds = rows
      .map((row) => row.assigneeUserId)
      .filter((id): id is number => id != null && Number.isFinite(id));

    const namesById = await this.loadUserNamesByIds(req, [...assigneeIds, ...completedByIds]);

    const versionIds = [
      ...rows.map((row) => row.templateVersionId),
      ...[...submissionsByAssignment.values()].map((s) => s.templateVersionId),
    ];
    const versionsById = await this.loadTemplateVersionsByIds(req, versionIds);

    return rows.map((row) => {
      const submission = submissionsByAssignment.get(row.id) || null;
      const versionId = submission?.templateVersionId ?? row.templateVersionId;
      const version = versionsById.get(versionId) || null;
      const submissionPayload =
        row.status === AssignmentStatus.COMPLETED
          ? this.serializeAssignedFormsSubmission(submission, row, version)
          : submission
            ? {
                id: submission.id,
                assignmentId: submission.assignmentId,
                status: submission.status,
                submittedAt: submission.submittedAt,
                answers: submission.answers || {},
              }
            : null;

      const completedAt = row.completedAt || submission?.submittedAt || null;
      const completedByUserId = row.completedByUserId ?? submission?.submittedBy ?? null;
      const mode = row.assignmentType || AssignmentType.INDIVIDUAL;
      const completion = buildAssignmentCompletion({
        status: row.status,
        assignmentType: mode,
        completedByUserId,
        completedAt,
        completedByName:
          completedByUserId != null ? namesById.get(completedByUserId) || null : null,
        viewerUserId,
      });

      const action =
        row.status === AssignmentStatus.COMPLETED
          ? 'view'
          : row.status === AssignmentStatus.IN_PROGRESS
            ? 'continue'
            : row.status === AssignmentStatus.PENDING || row.status === AssignmentStatus.OVERDUE
              ? 'open'
              : null;

      const isUpcomingPending =
        row.status === AssignmentStatus.PENDING &&
        this.startOfDayUtc(row.dueAt).getTime() >= this.startOfDayUtc(new Date()).getTime();

      return {
        id: row.id,
        templateId: row.templateId,
        templateVersionId: row.templateVersionId,
        formName: this.resolveFormName(row.template),
        assigneeUserId: row.assigneeUserId,
        assigneeName:
          row.assigneeUserId != null
            ? namesById.get(row.assigneeUserId) || `User #${row.assigneeUserId}`
            : null,
        dueAt: row.dueAt,
        dueDateLabel: this.formatDueDateLabel(row.dueAt),
        status: row.status,
        statusLabel: isUpcomingPending ? 'Upcoming' : this.statusLabel(row.status),
        mode,
        sharedGroupKey: row.sharedGroupKey,
        submittedAt: submission?.submittedAt ?? row.completedAt ?? null,
        submittedAtLabel: submission?.submittedAt
          ? this.formatSubmittedAtLabel(submission.submittedAt)
          : row.completedAt
            ? this.formatSubmittedAtLabel(row.completedAt)
            : null,
        action,
        submissionId: submissionPayload?.id ?? submission?.id ?? null,
        /** Full answers + template.schema for completed rows (read-only View). */
        submission: submissionPayload,
        completion,
        completedByUserId,
        completedAt,
      };
    });
  }

  private formatSubmittedAtLabel(value: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    }).format(value instanceof Date ? value : new Date(value));
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

  async start(req: any, id: number, dto?: { answers?: Record<string, any> }) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const submissionRepo = req.tenantConnection.getRepository(DataCollectionSubmission);
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

      const actorId = this.getActorId(req);
      assignment.status = AssignmentStatus.IN_PROGRESS;
      assignment.updatedBy = actorId;
      const saved = await repo.save(assignment);

      // Persist / resume draft answers so leaving and returning keeps field state.
      let draft = (
        await submissionRepo.find({
          where: { assignmentId: saved.id, status: SubmissionStatus.DRAFT },
          order: { updatedAt: 'DESC' },
          take: 1,
        })
      )[0];
      if (draft) {
        if (dto?.answers !== undefined) {
          draft.answers = dto.answers;
          draft.updatedBy = actorId;
          draft = await submissionRepo.save(draft);
        }
      } else {
        draft = await submissionRepo.save(
          submissionRepo.create({
            assignmentId: saved.id,
            templateVersionId: saved.templateVersionId,
            submittedBy: actorId,
            answers: dto?.answers || {},
            status: SubmissionStatus.DRAFT,
            submittedAt: null,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      }

      const [data] = await this.serializeAssignments(req, [saved], actorId);

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
    const startOfToday = this.startOfDayUtc(new Date());
    const { hasHistory, floorByAssigneeKey } = await this.loadAssigneeMaterializeFloors(
      assignmentRepo,
      template.id,
      startOfToday,
    );

    // Drop open past rows before each assignee's effective start (fixes mid-schedule add backfill).
    if (hasHistory && floorByAssigneeKey.size) {
      await this.cancelOpenAssignmentsBeforeFloor(assignmentRepo, template.id, floorByAssigneeKey);
    }

    const created: DataCollectionAssignment[] = [];

    for (const dueAt of dueDates) {
      for (const target of targets) {
        const assigneeKey =
          target.userId != null ? `u:${target.userId}` : `jp:${target.jobPositionId}`;

        // First publish (no history): keep full frequency window, including past overdue.
        // Later: each assignee starts at their floor (today for net-new; else earliest
        // completed / upcoming open due date — never backfill earlier overdues).
        if (hasHistory) {
          const floor = floorByAssigneeKey.get(assigneeKey) ?? startOfToday;
          if (this.startOfDayUtc(dueAt).getTime() < floor.getTime()) {
            continue;
          }
        }

        const dueIso = dueAt.toISOString();
        const occurrenceKey = [template.id, version.id, dueIso, assigneeKey].join(':');
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

  /**
   * Per-assignee materialize floor for mid-lifecycle rematerialize.
   * - No non-cancelled history for the template → first publish (caller skips floors).
   * - Net-new assignee → not in map (caller uses startOfToday).
   * - Existing with completed or upcoming open work → min of those due dates.
   * - Existing with only past overdue → startOfToday (so we don't keep a false backlog).
   */
  private async loadAssigneeMaterializeFloors(
    assignmentRepo: any,
    templateId: number,
    startOfToday: Date,
  ): Promise<{ hasHistory: boolean; floorByAssigneeKey: Map<string, Date> }> {
    const rows: Array<{
      assigneeUserId: number | null;
      jobPositionId: number | null;
      dueAt: Date;
      status: AssignmentStatus;
    }> = await assignmentRepo.find({
      where: { templateId },
      select: ['assigneeUserId', 'jobPositionId', 'dueAt', 'status'],
    });

    const floorByAssigneeKey = new Map<string, Date>();
    const grouped = new Map<string, typeof rows>();

    for (const row of rows || []) {
      if (row.status === AssignmentStatus.CANCELLED) continue;
      const key =
        row.assigneeUserId != null
          ? `u:${Number(row.assigneeUserId)}`
          : row.jobPositionId != null
            ? `jp:${Number(row.jobPositionId)}`
            : null;
      if (!key) continue;
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }

    const hasHistory = grouped.size > 0;
    const todayMs = startOfToday.getTime();

    for (const [key, list] of grouped.entries()) {
      const meaningful = list.filter((row) => {
        if (row.status === AssignmentStatus.COMPLETED) return true;
        if (!this.isOpenAssignmentStatus(row.status)) return false;
        return this.startOfDayUtc(row.dueAt).getTime() >= todayMs;
      });

      if (!meaningful.length) {
        // Only past overdue/open — keep their earliest due as floor so rematerialize
        // can refresh the existing backlog (not treat them as starting today).
        let minMs = Number.POSITIVE_INFINITY;
        for (const row of list) {
          const ms = this.startOfDayUtc(row.dueAt).getTime();
          if (ms < minMs) minMs = ms;
        }
        floorByAssigneeKey.set(key, new Date(minMs));
        continue;
      }

      let minMs = Number.POSITIVE_INFINITY;
      for (const row of meaningful) {
        const ms = this.startOfDayUtc(row.dueAt).getTime();
        if (ms < minMs) minMs = ms;
      }
      floorByAssigneeKey.set(key, new Date(minMs));
    }

    return { hasHistory, floorByAssigneeKey };
  }

  /** Cancel open/overdue rows earlier than each assignee's materialize floor. */
  private async cancelOpenAssignmentsBeforeFloor(
    assignmentRepo: any,
    templateId: number,
    floorByAssigneeKey: Map<string, Date>,
  ): Promise<void> {
    for (const [key, floor] of floorByAssigneeKey.entries()) {
      const qb = assignmentRepo
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
        .andWhere('due_at < :floor', { floor });

      if (key.startsWith('u:')) {
        qb.andWhere('assignee_user_id = :userId', { userId: Number(key.slice(2)) });
      } else if (key.startsWith('jp:')) {
        qb.andWhere('job_position_id = :jobPositionId', {
          jobPositionId: Number(key.slice(3)),
        });
      } else {
        continue;
      }

      await qb.execute();
    }
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
   * Midnight UTC dueAts stay open for the whole due day (legacy date-only schedules).
   * Timed dueAts (e.g. 15:06 → 3:06 PM) become overdue once that instant has passed.
   */
  private openStatusForDueAt(dueAt: Date, now = new Date()): AssignmentStatus {
    if (this.frequencyService.hasClockTime(dueAt)) {
      return dueAt.getTime() < now.getTime()
        ? AssignmentStatus.OVERDUE
        : AssignmentStatus.PENDING;
    }
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
      // Frequency rematerialize uses a new versionId in occurrenceKey. If this
      // assignee already completed the same due day, keep that row (submission
      // stays linked) instead of creating an empty open clone.
      const fulfilled = await this.findCompletedOccurrenceForDue(assignmentRepo, params);
      if (fulfilled) {
        await this.cancelOpenDuplicatesForDue(assignmentRepo, params, fulfilled.id);
        return fulfilled;
      }
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
      const fulfilled = await this.findCompletedOccurrenceForDue(assignmentRepo, params);
      if (fulfilled) {
        await this.cancelOpenDuplicatesForDue(assignmentRepo, params, fulfilled.id);
        return fulfilled;
      }
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
   * Find a COMPLETED assignment for the same template + assignee + due day,
   * regardless of template version / occurrenceKey (frequency rematerialize).
   */
  private async findCompletedOccurrenceForDue(
    assignmentRepo: any,
    params: {
      templateId: number;
      dueAt: Date;
      assigneeUserId: number | null;
      jobPositionId: number | null;
    },
  ): Promise<DataCollectionAssignment | null> {
    const where: Record<string, unknown> = {
      templateId: params.templateId,
      dueAt: params.dueAt,
      status: AssignmentStatus.COMPLETED,
    };
    if (params.assigneeUserId != null) {
      where.assigneeUserId = params.assigneeUserId;
    } else if (params.jobPositionId != null) {
      where.jobPositionId = params.jobPositionId;
    } else {
      return null;
    }

    const row = await assignmentRepo.findOne({ where });
    return row || null;
  }

  /**
   * Cancel open rematerialize clones for a due day that is already completed,
   * so my-work / history do not show a fake overdue beside the real submission.
   */
  private async cancelOpenDuplicatesForDue(
    assignmentRepo: any,
    params: {
      templateId: number;
      dueAt: Date;
      assigneeUserId: number | null;
      jobPositionId: number | null;
      actorId: number | null;
    },
    keepAssignmentId: number,
  ): Promise<void> {
    const qb = assignmentRepo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({
        status: AssignmentStatus.CANCELLED,
        cancelReason: AssignmentCancelReason.REPUBLISH,
        updatedBy: params.actorId,
      })
      .where('template_id = :templateId', { templateId: params.templateId })
      .andWhere('due_at = :dueAt', { dueAt: params.dueAt })
      .andWhere('id != :keepId', { keepId: keepAssignmentId })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          AssignmentStatus.PENDING,
          AssignmentStatus.IN_PROGRESS,
          AssignmentStatus.OVERDUE,
        ],
      });

    if (params.assigneeUserId != null) {
      qb.andWhere('assignee_user_id = :userId', { userId: params.assigneeUserId });
    } else if (params.jobPositionId != null) {
      qb.andWhere('job_position_id = :jobPositionId', {
        jobPositionId: params.jobPositionId,
      });
    } else {
      return;
    }

    await qb.execute();
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
      const now = new Date();
      // Midnight UTC dueAts stay open all due day; timed dueAts overdue after the clock time.
      const startOfToday = this.startOfDayUtc(now);
      const midnightUtc =
        `EXTRACT(HOUR FROM due_at AT TIME ZONE 'UTC') = 0` +
        ` AND EXTRACT(MINUTE FROM due_at AT TIME ZONE 'UTC') = 0` +
        ` AND EXTRACT(SECOND FROM due_at AT TIME ZONE 'UTC') = 0`;

      const midnightOverdue = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.OVERDUE })
        .where('status IN (:...statuses)', {
          statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
        })
        .andWhere(midnightUtc)
        .andWhere('due_at < :startOfToday', { startOfToday })
        .execute();

      const timedOverdue = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.OVERDUE })
        .where('status IN (:...statuses)', {
          statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
        })
        .andWhere(`NOT (${midnightUtc})`)
        .andWhere('due_at < :now', { now })
        .execute();

      // Heal rows marked overdue too early (still before their effective cutoff).
      const startedHealedMidnight = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.IN_PROGRESS })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere(midnightUtc)
        .andWhere('due_at >= :startOfToday', { startOfToday })
        .andWhere('updated_at > created_at')
        .execute();

      const pendingHealedMidnight = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.PENDING })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere(midnightUtc)
        .andWhere('due_at >= :startOfToday', { startOfToday })
        .execute();

      const startedHealedTimed = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.IN_PROGRESS })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere(`NOT (${midnightUtc})`)
        .andWhere('due_at >= :now', { now })
        .andWhere('updated_at > created_at')
        .execute();

      const pendingHealedTimed = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.PENDING })
        .where('status = :status', { status: AssignmentStatus.OVERDUE })
        .andWhere(`NOT (${midnightUtc})`)
        .andWhere('due_at >= :now', { now })
        .execute();

      return {
        success: true,
        message: 'Overdue assignments updated',
        data: {
          affected: (midnightOverdue.affected ?? 0) + (timedOverdue.affected ?? 0),
          healed:
            (startedHealedMidnight.affected ?? 0) +
            (pendingHealedMidnight.affected ?? 0) +
            (startedHealedTimed.affected ?? 0) +
            (pendingHealedTimed.affected ?? 0),
        },
      };
    } catch (error) {
      this.logger.error('markOverdue failed', error);
      throw new InternalServerErrorException('Failed to mark overdue assignments');
    }
  }

  /**
   * Point open assignments at a newly published version without cancelling them.
   * Used for form/report-only publishes so employees keep the same task status.
   */
  async retargetOpenAssignmentsToVersion(
    req: any,
    templateId: number,
    templateVersionId: number,
    actorId: number | null,
  ) {
    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    await repo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({
        templateVersionId,
        updatedBy: actorId,
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

  /**
   * Cancel open assignments when republishing after assign/frequency changes
   * (optionally excluding the new version). Includes today + past overdue —
   * due_at is stored as UTC midnight, so a wall-clock `due_at >= now` check
   * incorrectly skips same-day open work.
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
      });

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
