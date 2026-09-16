import { BadRequestException } from '@nestjs/common';
import { AssignmentCancelReason, AssignmentStatus } from '../entities/enums';
import { AssignmentsService } from './assignments.service';
import { FrequencyService } from './frequency.service';

describe('AssignmentsService materializeFromTemplate (frequency flow)', () => {
  const frequencyService = new FrequencyService();
  let service: AssignmentsService;
  let savedRows: any[];
  let findOneMock: jest.Mock;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let assignmentRepo: any;
  let req: any;

  const template = {
    id: 10,
    schema: {
      assign: { users: [101], jobPosition: [] },
      frequency: {
        type: 'recurring',
        date: '2026-09-02',
        jobPosition: null,
        recurring: {
          every: 1,
          interval: 'day',
          repeatCount: 5,
          daysOfWeek: [],
          monthMode: 'dayOfMonth',
          dayOfMonth: 1,
          weekOrder: 'first',
          onTheMonth: 'january',
          yearDay: 1,
          yearMonth: 'january',
        },
      },
    },
  } as any;

  const version = { id: 20, schemaSnapshot: template.schema } as any;

  beforeEach(() => {
    savedRows = [];
    findOneMock = jest.fn().mockResolvedValue(null);
    createMock = jest.fn((row) => ({ ...row }));
    saveMock = jest.fn(async (row) => {
      const saved = { id: savedRows.length + 1, ...row };
      savedRows.push(saved);
      return saved;
    });
    assignmentRepo = {
      findOne: findOneMock,
      create: createMock,
      save: saveMock,
    };
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity) => {
          // Assignment repo is requested first / by entity name usage in materialize
          if (entity?.name === 'DynamicModule' || entity?.name === 'EntityDynamicData') {
            return { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
          }
          return assignmentRepo;
        }),
      },
    };
    service = new AssignmentsService(frequencyService);
  });

  it('creates one assignment per daily occurrence for the assignee (UI daily × 5)', async () => {
    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created).toHaveLength(5);
    expect(saveMock).toHaveBeenCalledTimes(5);
    expect(created.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
    expect(created.every((a) => a.assigneeUserId === 101)).toBe(true);
    expect(
      created.every(
        (a) =>
          a.status === AssignmentStatus.PENDING || a.status === AssignmentStatus.OVERDUE,
      ),
    ).toBe(true);
    expect(created[0].occurrenceKey).toBe('10:20:2026-09-02T00:00:00.000Z:u:101');
    expect(created[4].occurrenceKey).toBe('10:20:2026-09-06T00:00:00.000Z:u:101');
  });

  it('creates assignments for monthly On the Third weekday × 2', async () => {
    const monthlyTemplate = {
      ...template,
      schema: {
        assign: { users: [101], jobPosition: [] },
        frequency: {
          type: 'recurring',
          date: '2026-01-01',
          recurring: {
            every: 1,
            interval: 'month',
            repeatCount: 2,
            monthMode: 'onThe',
            weekOrder: 'third',
            daysOfWeek: ['monday'],
          },
        },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      monthlyTemplate,
      { id: 20, schemaSnapshot: monthlyTemplate.schema } as any,
      1,
    );

    expect(created).toHaveLength(2);
    expect(created.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-01-19',
      '2026-02-16',
    ]);
  });

  it('is idempotent when occurrenceKey already exists', async () => {
    findOneMock.mockResolvedValue({
      id: 99,
      occurrenceKey: '10:20:2026-09-02T00:00:00.000Z:u:101',
      assigneeUserId: 101,
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created).toHaveLength(5);
    expect(saveMock).not.toHaveBeenCalled();
    expect(created.every((a) => a.id === 99)).toBe(true);
  });

  it('creates one row per assignee × occurrence', async () => {
    const multiUserTemplate = {
      ...template,
      schema: {
        assign: { mode: 'individual', users: [101, 202], jobPosition: null },
        frequency: {
          type: 'recurring',
          date: '2026-09-01',
          recurring: { every: 1, interval: 'day', repeatCount: 2 },
        },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      multiUserTemplate,
      { id: 20, schemaSnapshot: multiUserTemplate.schema } as any,
      1,
    );

    expect(created).toHaveLength(4); // 2 users × 2 days
    const keys = created.map((a) => a.occurrenceKey).sort();
    expect(keys).toEqual([
      '10:20:2026-09-01T00:00:00.000Z:u:101',
      '10:20:2026-09-01T00:00:00.000Z:u:202',
      '10:20:2026-09-02T00:00:00.000Z:u:101',
      '10:20:2026-09-02T00:00:00.000Z:u:202',
    ]);
    expect(created.every((a) => a.assignmentType === 'individual')).toBe(true);
    expect(created.every((a) => a.sharedGroupKey == null)).toBe(true);
  });

  it('links shared assignees with the same sharedGroupKey when assign.mode=shared', async () => {
    const sharedTemplate = {
      ...template,
      schema: {
        assign: {
          mode: 'shared',
          users: [101, 202],
          jobPosition: null,
        },
        report: {
          mode: 'shared',
          users: null,
          jobPosition: [4],
        },
        frequency: {
          type: 'atOnce',
          date: '2026-09-15',
          recurring: null,
        },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      sharedTemplate,
      { id: 20, schemaSnapshot: sharedTemplate.schema } as any,
      1,
    );

    expect(created).toHaveLength(2);
    expect(created.every((a) => a.assignmentType === 'shared')).toBe(true);
    expect(created[0].sharedGroupKey).toBe('10:20:2026-09-15T00:00:00.000Z:shared');
    expect(created[1].sharedGroupKey).toBe(created[0].sharedGroupKey);
    expect(created.map((a) => a.occurrenceKey).sort()).toEqual([
      '10:20:2026-09-15T00:00:00.000Z:u:101',
      '10:20:2026-09-15T00:00:00.000Z:u:202',
    ]);
  });

  it('accepts frontend payload with users:null and assign.mode=individual', async () => {
    const jpUsers = [
      { entityId: 11, data: { jobPosition: 4 } },
      { entityId: 12, data: { jobPosition: 4 } },
      { entityId: 99, data: { jobPosition: 9 } },
    ];
    req.tenantConnection.getRepository = jest.fn((entity) => {
      if (entity?.name === 'DynamicModule') {
        return { findOne: jest.fn().mockResolvedValue({ id: 1, slug: 'users' }) };
      }
      if (entity?.name === 'EntityDynamicData') {
        return { find: jest.fn().mockResolvedValue(jpUsers) };
      }
      return assignmentRepo;
    });

    const frontendPayloadTemplate = {
      ...template,
      schema: {
        assign: {
          jobPosition: [4],
          users: null,
          mode: 'individual',
        },
        report: {
          jobPosition: [4],
          users: null,
          mode: 'shared',
        },
        frequency: {
          type: 'atOnce',
          date: '2026-09-15',
          recurring: null,
        },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      frontendPayloadTemplate,
      { id: 20, schemaSnapshot: frontendPayloadTemplate.schema } as any,
      1,
    );

    expect(created).toHaveLength(2);
    expect(created.map((a) => a.assigneeUserId).sort()).toEqual([11, 12]);
    expect(created.every((a) => a.assignmentType === 'individual')).toBe(true);
    expect(created.every((a) => a.sharedGroupKey == null)).toBe(true);
  });

  it('uses assign.mode=shared with users:null + jobPosition', async () => {
    const jpUsers = [
      { entityId: 11, data: { jobPosition: 4 } },
      { entityId: 12, data: { jobPosition: 4 } },
    ];
    req.tenantConnection.getRepository = jest.fn((entity) => {
      if (entity?.name === 'DynamicModule') {
        return { findOne: jest.fn().mockResolvedValue({ id: 1, slug: 'users' }) };
      }
      if (entity?.name === 'EntityDynamicData') {
        return { find: jest.fn().mockResolvedValue(jpUsers) };
      }
      return assignmentRepo;
    });

    const sharedJpTemplate = {
      ...template,
      schema: {
        assign: { jobPosition: [4], users: null, mode: 'shared' },
        report: { jobPosition: [4], users: null, mode: 'individual' },
        frequency: { type: 'atOnce', date: '2026-09-15', recurring: null },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      sharedJpTemplate,
      { id: 20, schemaSnapshot: sharedJpTemplate.schema } as any,
      1,
    );

    expect(created).toHaveLength(2);
    expect(created.every((a) => a.assignmentType === 'shared')).toBe(true);
    expect(created.every((a) => a.sharedGroupKey === '10:20:2026-09-15T00:00:00.000Z:shared')).toBe(
      true,
    );
  });

  it('throws when frequency produces no dates (atOnce without date)', async () => {
    const bad = {
      ...template,
      schema: {
        assign: { users: [101], jobPosition: [] },
        frequency: { type: 'atOnce', date: null, recurring: null },
      },
    } as any;

    await expect(
      service.materializeFromTemplate(req, bad, { id: 20, schemaSnapshot: bad.schema } as any, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips materialization when no assignees', async () => {
    const emptyAssign = {
      ...template,
      schema: {
        assign: { users: [], jobPosition: [] },
        frequency: template.schema.frequency,
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      emptyAssign,
      { id: 20, schemaSnapshot: emptyAssign.schema } as any,
      1,
    );

    expect(created).toEqual([]);
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe('AssignmentsService materializeFromTemplate (restore rules)', () => {
  const frequencyService = new FrequencyService();
  let service: AssignmentsService;
  let findOneMock: jest.Mock;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let assignmentRepo: any;
  let req: any;

  const dueAt = new Date('2027-09-15T00:00:00.000Z');
  const occurrenceKey = '10:20:2027-09-15T00:00:00.000Z:u:101';

  const template = {
    id: 10,
    schema: {
      assign: { users: [101], jobPosition: [] },
      frequency: { type: 'atOnce', date: '2027-09-15', recurring: null },
    },
  } as any;

  const version = { id: 20, schemaSnapshot: template.schema } as any;

  beforeEach(() => {
    findOneMock = jest.fn().mockResolvedValue(null);
    createMock = jest.fn((row) => ({ ...row }));
    saveMock = jest.fn(async (row) => ({ id: row.id ?? 1, ...row }));
    assignmentRepo = {
      findOne: findOneMock,
      create: createMock,
      save: saveMock,
    };
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity) => {
          if (entity?.name === 'DynamicModule' || entity?.name === 'EntityDynamicData') {
            return { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
          }
          return assignmentRepo;
        }),
      },
    };
    service = new AssignmentsService(frequencyService);
  });

  it('reactivates template_archived cancelled assignments', async () => {
    findOneMock.mockResolvedValue({
      id: 5,
      occurrenceKey,
      status: AssignmentStatus.CANCELLED,
      cancelReason: AssignmentCancelReason.TEMPLATE_ARCHIVED,
      dueAt,
      completedByUserId: null,
      completedAt: null,
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created).toHaveLength(1);
    expect(saveMock).toHaveBeenCalled();
    expect(created[0].status).toBe(AssignmentStatus.PENDING);
    expect(created[0].cancelReason).toBeNull();
    expect(created[0].occurrenceKey).toBe(occurrenceKey);
  });

  it('reactivates legacy cancelled rows with null cancelReason', async () => {
    findOneMock.mockResolvedValue({
      id: 5,
      occurrenceKey,
      status: AssignmentStatus.CANCELLED,
      cancelReason: null,
      dueAt,
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].status).toBe(AssignmentStatus.PENDING);
    expect(created[0].cancelReason).toBeNull();
  });

  it('does not resurrect completed assignments', async () => {
    findOneMock.mockResolvedValue({
      id: 5,
      occurrenceKey,
      status: AssignmentStatus.COMPLETED,
      cancelReason: null,
      dueAt,
      completedByUserId: 101,
      completedAt: dueAt,
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].status).toBe(AssignmentStatus.COMPLETED);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('reuses open assignments without creating duplicates', async () => {
    findOneMock.mockResolvedValue({
      id: 5,
      occurrenceKey,
      status: AssignmentStatus.IN_PROGRESS,
      cancelReason: null,
      dueAt,
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].id).toBe(5);
    expect(created[0].status).toBe(AssignmentStatus.IN_PROGRESS);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('creates :reopen key when manual-cancelled blocks the occurrence', async () => {
    findOneMock.mockImplementation(async ({ where }: any) => {
      if (where.occurrenceKey === occurrenceKey) {
        return {
          id: 5,
          occurrenceKey,
          status: AssignmentStatus.CANCELLED,
          cancelReason: AssignmentCancelReason.MANUAL,
          dueAt,
        };
      }
      return null;
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].occurrenceKey).toBe(`${occurrenceKey}:reopen`);
    expect(created[0].status).toBe(AssignmentStatus.PENDING);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceKey: `${occurrenceKey}:reopen` }),
    );
  });

  it('reuses existing :reopen open assignment on second rematerialize (idempotent)', async () => {
    findOneMock.mockImplementation(async ({ where }: any) => {
      if (where.occurrenceKey === occurrenceKey) {
        return {
          id: 5,
          occurrenceKey,
          status: AssignmentStatus.CANCELLED,
          cancelReason: AssignmentCancelReason.MANUAL,
          dueAt,
        };
      }
      if (where.occurrenceKey === `${occurrenceKey}:reopen`) {
        return {
          id: 9,
          occurrenceKey: `${occurrenceKey}:reopen`,
          status: AssignmentStatus.PENDING,
          cancelReason: null,
          dueAt,
        };
      }
      return null;
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].id).toBe(9);
    expect(saveMock).not.toHaveBeenCalled();
  });

  it('does not resurrect republish-cancelled rows on the same key', async () => {
    findOneMock.mockImplementation(async ({ where }: any) => {
      if (where.occurrenceKey === occurrenceKey) {
        return {
          id: 5,
          occurrenceKey,
          status: AssignmentStatus.CANCELLED,
          cancelReason: AssignmentCancelReason.REPUBLISH,
          dueAt,
        };
      }
      return null;
    });

    const created = await service.materializeFromTemplate(req, template, version, 1);

    expect(created[0].occurrenceKey).toBe(`${occurrenceKey}:reopen`);
  });
});

describe('AssignmentsService findAll / findMyWork (today + date filters)', () => {
  let service: AssignmentsService;
  let qb: any;
  let andWhereMock: jest.Mock;
  let getManyAndCountMock: jest.Mock;
  let req: any;

  beforeEach(() => {
    andWhereMock = jest.fn().mockReturnThis();
    getManyAndCountMock = jest.fn().mockResolvedValue([[], 0]);
    qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: andWhereMock,
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: getManyAndCountMock,
    };

    service = new AssignmentsService(new FrequencyService());
    (service as any).serializeAssignments = jest.fn().mockResolvedValue([]);

    req = {
      user: { id: 42 },
      tenantConnection: {
        getRepository: jest.fn(() => ({
          createQueryBuilder: jest.fn(() => qb),
        })),
      },
    };
  });

  it('filters by UTC due day when status=today', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));

    await service.findMyWork(req, { page: 1, limit: 15, status: 'today' });

    const dueCall = andWhereMock.mock.calls.find(([sql]) =>
      String(sql).includes('dueAt BETWEEN'),
    );
    expect(dueCall).toBeDefined();
    expect(dueCall[1].dueStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(dueCall[1].dueEnd.toISOString()).toBe('2026-09-15T23:59:59.999Z');

    const statusCall = andWhereMock.mock.calls.find(
      ([sql, params]) => String(sql).includes('assignment.status = :status') && params?.status === 'today',
    );
    expect(statusCall).toBeUndefined();

    jest.useRealTimers();
  });

  it('filters by date when date is provided without status=today', async () => {
    await service.findMyWork(req, { page: 1, limit: 15, date: '2026-09-15' });

    const dueCall = andWhereMock.mock.calls.find(([sql]) =>
      String(sql).includes('dueAt BETWEEN'),
    );
    expect(dueCall[1].dueStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(dueCall[1].dueEnd.toISOString()).toBe('2026-09-15T23:59:59.999Z');
  });

  it('uses date (not clock today) when both status=today and date are set', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));

    await service.findMyWork(req, {
      page: 1,
      limit: 15,
      status: 'today',
      date: '2026-09-15',
    });

    const dueCall = andWhereMock.mock.calls.find(([sql]) =>
      String(sql).includes('dueAt BETWEEN'),
    );
    expect(dueCall[1].dueStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
    expect(dueCall[1].dueEnd.toISOString()).toBe('2026-09-15T23:59:59.999Z');

    jest.useRealTimers();
  });

  it('applies real status and date together', async () => {
    await service.findAll(req, {
      page: 1,
      limit: 15,
      status: AssignmentStatus.PENDING,
      date: '2026-09-15',
    });

    expect(andWhereMock).toHaveBeenCalledWith('assignment.status = :status', {
      status: AssignmentStatus.PENDING,
    });
    const dueCall = andWhereMock.mock.calls.find(([sql]) =>
      String(sql).includes('dueAt BETWEEN'),
    );
    expect(dueCall[1].dueStart.toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('filters my-work to active templates and excludes cancelled by default', async () => {
    await service.findMyWork(req, { page: 1, limit: 15 });

    expect(andWhereMock).toHaveBeenCalledWith('template.status = :templateStatus', {
      templateStatus: 'active',
    });
    expect(andWhereMock).toHaveBeenCalledWith('template.isActive = true');
    expect(andWhereMock).toHaveBeenCalledWith('template.deletedAt IS NULL');
    expect(andWhereMock).toHaveBeenCalledWith('assignment.status != :cancelledStatus', {
      cancelledStatus: AssignmentStatus.CANCELLED,
    });
  });
});

describe('AssignmentsService markOverdue / openStatusForDueAt (calendar day)', () => {
  let service: AssignmentsService;

  beforeEach(() => {
    service = new AssignmentsService(new FrequencyService());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps same-day UTC midnight dueAts as pending, not overdue', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T17:25:00.000Z'));

    const dueToday = new Date('2026-09-16T00:00:00.000Z');
    const dueYesterday = new Date('2026-09-15T00:00:00.000Z');

    expect((service as any).openStatusForDueAt(dueToday)).toBe(AssignmentStatus.PENDING);
    expect((service as any).openStatusForDueAt(dueYesterday)).toBe(AssignmentStatus.OVERDUE);
  });

  it('marks overdue only when due_at is before start of today UTC', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T17:25:00.000Z'));

    const executeMock = jest.fn().mockResolvedValue({ affected: 2 });
    const andWhereMock = jest.fn().mockReturnThis();
    const whereMock = jest.fn().mockReturnThis();
    const setMock = jest.fn().mockReturnThis();
    const updateMock = jest.fn().mockReturnThis();
    const qb = {
      update: updateMock,
      set: setMock,
      where: whereMock,
      andWhere: andWhereMock,
      execute: executeMock,
    };

    const req = {
      tenantConnection: {
        getRepository: jest.fn(() => ({
          createQueryBuilder: jest.fn(() => qb),
        })),
      },
    };

    const result = await service.markOverdue(req);

    expect(andWhereMock).toHaveBeenCalledWith('due_at < :startOfToday', {
      startOfToday: new Date('2026-09-16T00:00:00.000Z'),
    });
    expect(andWhereMock).toHaveBeenCalledWith('due_at >= :startOfToday', {
      startOfToday: new Date('2026-09-16T00:00:00.000Z'),
    });
    expect(result.data.affected).toBe(2);
    expect(executeMock).toHaveBeenCalledTimes(3);
  });
});
