import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { DynamicModule, EntityDynamicData } from '../../form-builder/entities';
import { User } from '../../users/entities';
import {
  AssignmentStatus,
  AssignmentType,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  SubmissionStatus,
  TemplateVersion,
} from '../entities';
import { QueryAssignmentDto } from '../dto/assignments/query-assignment.dto';
import {
  buildAssignmentCompletion,
  resolveAssignmentType,
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

      const qb = repo
        .createQueryBuilder('assignment')
        .leftJoinAndSelect('assignment.template', 'template');

      const isTodayStatus = query.status === 'today';
      if (query.status && !isTodayStatus) {
        qb.andWhere('assignment.status = :status', { status: query.status });
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

      const mineOnly = query.mine === true || query.mine === 'true' || query.mine === '1';

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
    const assignmentType = resolveAssignmentType(assign.assignmentType);

    const userIds = new Set<number>((assign.users || []).map(Number).filter(Number.isFinite));
    const jobPositionIds: number[] = (assign.jobPosition || []).map(Number).filter(Number.isFinite);

    for (const jpId of jobPositionIds) {
      const resolved = await this.resolveUsersByJobPosition(req, jpId);
      resolved.forEach((id) => userIds.add(id));
    }

    if (!userIds.size && !jobPositionIds.length) {
      this.logger.warn(`Template ${template.id}: no assignees; skipping assignment materialization`);
      return [];
    }

    const dueDates = this.frequencyService.expandOccurrences(frequency);
    if (!dueDates.length) {
      throw new BadRequestException('Frequency produced no occurrence dates. Check date and recurring settings.');
    }

    const assignmentRepo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const created: DataCollectionAssignment[] = [];

    const targets: Array<{ userId: number | null; jobPositionId: number | null }> = [];
    for (const userId of userIds) {
      targets.push({ userId, jobPositionId: null });
    }
    // When no users resolve from job positions, keep job-position-targeted rows.
    if (!userIds.size) {
      for (const jpId of jobPositionIds) {
        targets.push({ userId: null, jobPositionId: jpId });
      }
    }

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

        const existing = await assignmentRepo.findOne({ where: { occurrenceKey } });
        if (existing) {
          created.push(existing);
          continue;
        }

        const row = assignmentRepo.create({
          templateId: template.id,
          templateVersionId: version.id,
          assigneeUserId: target.userId,
          jobPositionId: target.jobPositionId,
          dueAt,
          status: AssignmentStatus.PENDING,
          assignmentType,
          sharedGroupKey,
          completedByUserId: null,
          completedAt: null,
          occurrenceKey,
          createdBy: actorId,
          updatedBy: actorId,
        });
        const saved = await assignmentRepo.save(row);
        created.push(saved);
      }
    }

    return created;
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

      const matched: number[] = [];
      for (const row of rows) {
        const data = row.data || {};
        const values = Object.values(data);
        const hit = values.some((v) => {
          if (v === jobPositionId || v === String(jobPositionId)) return true;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const obj = v as Record<string, unknown>;
            return obj.id === jobPositionId || obj.id === String(jobPositionId);
          }
          if (Array.isArray(v)) {
            return v.some(
              (item) =>
                item === jobPositionId ||
                item === String(jobPositionId) ||
                (item && typeof item === 'object' && (item as any).id == jobPositionId),
            );
          }
          return false;
        });
        if (hit) matched.push(row.entityId);
      }
      return matched;
    } catch (error) {
      this.logger.warn(`Failed to resolve users for job position ${jobPositionId}: ${(error as Error).message}`);
      return [];
    }
  }

  async markOverdue(req: any) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const now = new Date();
      const result = await repo
        .createQueryBuilder()
        .update(DataCollectionAssignment)
        .set({ status: AssignmentStatus.OVERDUE })
        .where('status IN (:...statuses)', {
          statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
        })
        .andWhere('due_at < :now', { now })
        .execute();

      return {
        success: true,
        message: 'Overdue assignments updated',
        data: { affected: result.affected ?? 0 },
      };
    } catch (error) {
      this.logger.error('markOverdue failed', error);
      throw new InternalServerErrorException('Failed to mark overdue assignments');
    }
  }

  async cancelFutureForTemplate(req: any, templateId: number, fromVersionId?: number) {
    const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
    const qb = repo
      .createQueryBuilder()
      .update(DataCollectionAssignment)
      .set({ status: AssignmentStatus.CANCELLED })
      .where('template_id = :templateId', { templateId })
      .andWhere('status IN (:...statuses)', {
        statuses: [AssignmentStatus.PENDING, AssignmentStatus.IN_PROGRESS],
      })
      .andWhere('due_at >= :now', { now: new Date() });

    if (fromVersionId) {
      qb.andWhere('template_version_id != :versionId', { versionId: fromVersionId });
    }

    await qb.execute();
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
