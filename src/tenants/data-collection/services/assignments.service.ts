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
  DataCollectionAssignment,
  DataCollectionTemplate,
  TemplateVersion,
} from '../entities';
import { QueryAssignmentDto } from '../dto/assignments/query-assignment.dto';
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

  /**
   * Materialize assignments from template schema.assign + schema.frequency.
   * Idempotent via occurrenceKey unique constraint.
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
      throw new BadRequestException('Frequency produced no occurrence dates. Check startDate and schedule.');
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

  async findAll(req: any, query: QueryAssignmentDto) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;
      const actorId = this.getActorId(req);

      const qb = repo.createQueryBuilder('assignment');

      if (query.status) {
        qb.andWhere('assignment.status = :status', { status: query.status });
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
      const [data, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;

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
      const assignment = await repo.findOne({ where: { id } });
      if (!assignment) throw new NotFoundException(`Assignment with ID ${id} not found`);
      return { success: true, data: assignment };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve assignment');
    }
  }

  async start(req: any, id: number) {
    try {
      const repo = req.tenantConnection.getRepository(DataCollectionAssignment);
      const assignment = await repo.findOne({ where: { id } });
      if (!assignment) throw new NotFoundException(`Assignment with ID ${id} not found`);

      if (assignment.status === AssignmentStatus.COMPLETED) {
        throw new BadRequestException('Assignment is already completed');
      }
      if (assignment.status === AssignmentStatus.CANCELLED) {
        throw new BadRequestException('Assignment is cancelled');
      }

      assignment.status = AssignmentStatus.IN_PROGRESS;
      assignment.updatedBy = this.getActorId(req);
      const saved = await repo.save(assignment);
      return { success: true, message: 'Assignment started', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to start assignment');
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
