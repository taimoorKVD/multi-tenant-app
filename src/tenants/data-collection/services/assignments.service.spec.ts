import { BadRequestException } from '@nestjs/common';
import { AssignmentStatus } from '../entities/enums';
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
    expect(created.every((a) => a.status === AssignmentStatus.PENDING)).toBe(true);
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
        assign: { users: [101, 202], jobPosition: [] },
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

  it('links shared assignees with the same sharedGroupKey per occurrence', async () => {
    const sharedTemplate = {
      ...template,
      schema: {
        assign: {
          assignmentType: 'shared',
          users: [101, 202],
          jobPosition: [],
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
