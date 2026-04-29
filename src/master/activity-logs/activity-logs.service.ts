import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities';

interface CreateActivityLogInput {
  tenant?: string | null;
  userId?: number | null;
  userEmail?: string | null;
  action?: string | null;
  module?: string | null;
  entity?: string | null;
  entityId?: string | null;
  method: string;
  endpoint: string;
  statusCode?: number | null;
  status?: string | null;
  durationMs: number;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  query?: Record<string, unknown> | null;
  body?: Record<string, unknown> | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  errorMessage?: string | null;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {}

  async createLog(input: CreateActivityLogInput): Promise<void> {
    const entity = this.activityLogRepo.create({
      tenant: input.tenant ?? null,
      userId: input.userId ?? null,
      userEmail: input.userEmail ?? null,
      action: input.action ?? null,
      module: input.module ?? null,
      entity: input.entity ?? null,
      entityId: input.entityId ?? null,
      method: input.method,
      endpoint: input.endpoint,
      statusCode: input.statusCode ?? null,
      status: input.status ?? null,
      durationMs: input.durationMs,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      requestId: input.requestId ?? null,
      query: input.query ?? null,
      body: input.body ?? null,
      oldData: input.oldData ?? null,
      newData: input.newData ?? null,
      errorMessage: input.errorMessage ?? null,
    });

    await this.activityLogRepo.save(entity);
  }

  async listLogs(params: {
    page?: number;
    limit?: number;
    module?: string;
    action?: string;
    method?: string;
    statusCode?: number;
    userId?: number;
    endpoint?: string;
    tenant?: string;
  }) {
    const take = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const page = Math.max(Number(params.page) || 1, 1);

    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC')
      .take(take)
      .skip((page - 1) * take);

    if (params.method?.trim()) {
      qb.andWhere('LOWER(log.method) = LOWER(:method)', {
        method: params.method.trim(),
      });
    }

    if (params.module?.trim()) {
      qb.andWhere('LOWER(log.module) = LOWER(:module)', {
        module: params.module.trim(),
      });
    }

    if (params.action?.trim()) {
      qb.andWhere('LOWER(log.action) = LOWER(:action)', {
        action: params.action.trim(),
      });
    }

    if (typeof params.statusCode === 'number' && !Number.isNaN(params.statusCode)) {
      qb.andWhere('log.statusCode = :statusCode', { statusCode: params.statusCode });
    }

    if (typeof params.userId === 'number' && !Number.isNaN(params.userId)) {
      qb.andWhere('log.userId = :userId', { userId: params.userId });
    }

    if (params.endpoint?.trim()) {
      qb.andWhere('log.endpoint ILIKE :endpoint', {
        endpoint: `%${params.endpoint.trim()}%`,
      });
    }

    if (params.tenant?.trim()) {
      qb.andWhere('LOWER(log.tenant) = LOWER(:tenant)', {
        tenant: params.tenant.trim(),
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      success: true,
      message: total > 0 ? 'Activity logs fetched successfully' : 'No activity logs found',
      data,
      meta: {
        total,
        page,
        lastPage: Math.max(Math.ceil(total / take), 1),
      },
    };
  }

  async getLogById(id: number) {
    const log = await this.activityLogRepo.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Activity log with ID ${id} not found.`);
    }

    return {
      success: true,
      message: 'Activity log fetched successfully',
      data: log,
    };
  }
}
