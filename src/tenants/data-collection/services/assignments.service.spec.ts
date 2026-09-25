import { BadRequestException } from '@nestjs/common';
import { AssignmentCancelReason, AssignmentStatus, SubmissionStatus } from '../entities/enums';
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
    findOneMock = jest.fn(async ({ where }: any) => {
      if (!where) return null;
      if (where.occurrenceKey) {
        return savedRows.find((row) => row.occurrenceKey === where.occurrenceKey) || null;
      }
      if (where.status === AssignmentStatus.COMPLETED) {
        return (
          savedRows.find((row) => {
            if (row.templateId !== where.templateId) return false;
            if (row.status !== AssignmentStatus.COMPLETED) return false;
            if (new Date(row.dueAt).getTime() !== new Date(where.dueAt).getTime()) return false;
            if (where.assigneeUserId != null) return row.assigneeUserId === where.assigneeUserId;
            if (where.jobPositionId != null) return row.jobPositionId === where.jobPositionId;
            return false;
          }) || null
        );
      }
      return null;
    });
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
      find: jest.fn(async (opts: any) => {
        const templateId = opts?.where?.templateId;
        if (templateId == null) return [...savedRows];
        return savedRows.filter((row) => row.templateId === templateId);
      }),
      createQueryBuilder: jest.fn(() => {
        const api: any = {};
        for (const method of ['update', 'set', 'where', 'andWhere']) {
          api[method] = jest.fn().mockReturnValue(api);
        }
        api.execute = jest.fn().mockResolvedValue({ affected: 0 });
        return api;
      }),
    };
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity) => {
          if (entity?.name === 'User') {
            return {
              createQueryBuilder: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
              })),
            };
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

  it.each([
    {
      name: 'atOnce',
      frequency: { type: 'atOnce', date: '2026-09-15', recurring: null },
      expectedDates: ['2026-09-15'],
    },
    {
      name: 'daily × 3',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 1, interval: 'day', repeatCount: 3 },
      },
      expectedDates: ['2026-09-01', '2026-09-02', '2026-09-03'],
    },
    {
      name: 'weekly × 3',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 1, interval: 'week', repeatCount: 3, daysOfWeek: [] },
      },
      expectedDates: ['2026-09-01', '2026-09-08', '2026-09-15'],
    },
    {
      name: 'weekly Mon/Wed × 2',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: {
          every: 1,
          interval: 'week',
          repeatCount: 2,
          daysOfWeek: ['monday', 'wednesday'],
        },
      },
      expectedDates: ['2026-09-02', '2026-09-07'],
    },
    {
      name: 'monthly dayOfMonth × 3',
      frequency: {
        type: 'recurring',
        date: '2026-01-10',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          dayOfMonth: 15,
        },
      },
      expectedDates: ['2026-01-15', '2026-02-15', '2026-03-15'],
    },
    {
      name: 'yearly dayOfMonth × 2',
      frequency: {
        type: 'recurring',
        date: '2026-03-01',
        recurring: {
          every: 1,
          interval: 'year',
          repeatCount: 2,
          monthMode: 'dayOfMonth',
          yearMonth: 'january',
          yearDay: 15,
        },
      },
      expectedDates: ['2026-01-15', '2027-01-15'],
    },
  ])('materializes frequency case: $name', async ({ frequency, expectedDates }) => {
    const caseTemplate = {
      id: 10,
      schema: {
        assign: { mode: 'individual', users: [101], jobPosition: null },
        frequency,
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      caseTemplate,
      { id: 20, schemaSnapshot: caseTemplate.schema } as any,
      1,
    );

    expect(created.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual(expectedDates);
    expect(created.every((a) => a.assigneeUserId === 101)).toBe(true);
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

  it('materializes next-day shared tasks when UI sends daily recurring with repeatCount:1', async () => {
    const dailyShared = {
      id: 10,
      schema: {
        formName: 'Daily Kitchen Checklist',
        assign: { mode: 'shared', users: [7], jobPosition: null },
        report: { mode: 'individual', users: null, jobPosition: [3, 2] },
        frequency: {
          type: 'recurring',
          date: '2026-09-17',
          jobPosition: null,
          recurring: {
            every: 1,
            interval: 'day',
            repeatCount: 1,
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

    const created = await service.materializeFromTemplate(
      req,
      dailyShared,
      { id: 20, schemaSnapshot: dailyShared.schema } as any,
      1,
    );

    expect(created).toHaveLength(365);
    expect(created[0].dueAt.toISOString().slice(0, 10)).toBe('2026-09-17');
    expect(created[1].dueAt.toISOString().slice(0, 10)).toBe('2026-09-18');
    expect(created[created.length - 1].dueAt.toISOString().slice(0, 10)).toBe('2027-09-16');
    expect(created.every((a) => a.assignmentType === 'shared')).toBe(true);
    expect(created.every((a) => a.assigneeUserId === 7)).toBe(true);
    expect(created[0].sharedGroupKey).toBe('10:20:2026-09-17T00:00:00.000Z:shared');
    expect(created[1].sharedGroupKey).toBe('10:20:2026-09-18T00:00:00.000Z:shared');
  });

  it('accepts frontend payload with users:null and assign.mode=individual', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { id: 11, jobPositionId: 4 },
        { id: 12, jobPositionId: 4 },
      ]),
    };
    req.tenantConnection.getRepository = jest.fn((entity) => {
      if (entity?.name === 'User') {
        return { createQueryBuilder: jest.fn(() => qb) };
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
    expect(created.every((a) => a.jobPositionId === 4)).toBe(true);
    expect(created.every((a) => a.assignmentType === 'individual')).toBe(true);
    expect(created.every((a) => a.sharedGroupKey == null)).toBe(true);
  });

  it('uses assign.mode=shared with users:null + jobPosition', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { id: 11, jobPositionId: 4 },
        { id: 12, jobPositionId: 4 },
      ]),
    };
    req.tenantConnection.getRepository = jest.fn((entity) => {
      if (entity?.name === 'User') {
        return { createQueryBuilder: jest.fn(() => qb) };
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
    expect(created.every((a) => a.jobPositionId === 4)).toBe(true);
    expect(created.every((a) => a.sharedGroupKey === '10:20:2026-09-15T00:00:00.000Z:shared')).toBe(
      true,
    );
  });

  it('rejects Assign when both users and jobPosition are set', async () => {
    const bothTemplate = {
      ...template,
      schema: {
        assign: { users: [101], jobPosition: [4], mode: 'individual' },
        frequency: { type: 'atOnce', date: '2026-09-15', recurring: null },
      },
    } as any;

    await expect(
      service.materializeFromTemplate(
        req,
        bothTemplate,
        { id: 20, schemaSnapshot: bothTemplate.schema } as any,
        1,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
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

describe('AssignmentsService materializeFromTemplate (all frequency → assign again)', () => {
  const frequencyService = new FrequencyService();
  let service: AssignmentsService;
  let savedRows: any[];
  let findOneMock: jest.Mock;
  let createMock: jest.Mock;
  let saveMock: jest.Mock;
  let assignmentRepo: any;
  let req: any;

  beforeEach(() => {
    savedRows = [];
    findOneMock = jest.fn(async ({ where }: any) => {
      if (!where) return null;
      if (where.occurrenceKey) {
        return savedRows.find((row) => row.occurrenceKey === where.occurrenceKey) || null;
      }
      if (where.status === AssignmentStatus.COMPLETED) {
        return (
          savedRows.find((row) => {
            if (row.templateId !== where.templateId) return false;
            if (row.status !== AssignmentStatus.COMPLETED) return false;
            if (new Date(row.dueAt).getTime() !== new Date(where.dueAt).getTime()) return false;
            if (where.assigneeUserId != null) return row.assigneeUserId === where.assigneeUserId;
            if (where.jobPositionId != null) return row.jobPositionId === where.jobPositionId;
            return false;
          }) || null
        );
      }
      return null;
    });
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
      find: jest.fn(async (opts: any) => {
        const templateId = opts?.where?.templateId;
        if (templateId == null) return [...savedRows];
        return savedRows.filter((row) => row.templateId === templateId);
      }),
      createQueryBuilder: jest.fn(() => {
        const api: any = {};
        for (const method of ['update', 'set', 'where', 'andWhere']) {
          api[method] = jest.fn().mockReturnValue(api);
        }
        api.execute = jest.fn().mockResolvedValue({ affected: 0 });
        return api;
      }),
    };
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity) => {
          if (entity?.name === 'User') {
            return {
              createQueryBuilder: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
              })),
            };
          }
          return assignmentRepo;
        }),
      },
    };
    service = new AssignmentsService(frequencyService);
  });

  async function materialize(
    frequency: Record<string, any>,
    versionId = 20,
    assigneeUserId = 101,
  ) {
    const template = {
      id: 10,
      schema: {
        assign: { mode: 'individual', users: [assigneeUserId], jobPosition: null },
        frequency,
      },
    } as any;
    return service.materializeFromTemplate(
      req,
      template,
      { id: versionId, schemaSnapshot: template.schema } as any,
      1,
    );
  }

  it.each([
    {
      name: 'atOnce',
      frequency: { type: 'atOnce', date: '2026-09-15', recurring: null },
      expectedDates: ['2026-09-15'],
    },
    {
      name: 'daily every 1 × 4',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 1, interval: 'day', repeatCount: 4 },
      },
      expectedDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04'],
    },
    {
      name: 'daily every 2 days × 3',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 2, interval: 'day', repeatCount: 3 },
      },
      expectedDates: ['2026-09-01', '2026-09-03', '2026-09-05'],
    },
    {
      name: 'weekly every 1 week × 3 (no weekdays)',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: { every: 1, interval: 'week', repeatCount: 3, daysOfWeek: [] },
      },
      expectedDates: ['2026-09-01', '2026-09-08', '2026-09-15'],
    },
    {
      name: 'weekly Mon/Fri × 2',
      frequency: {
        type: 'recurring',
        date: '2026-09-01',
        recurring: {
          every: 1,
          interval: 'week',
          repeatCount: 2,
          daysOfWeek: ['monday', 'friday'],
        },
      },
      expectedDates: ['2026-09-04', '2026-09-07'],
    },
    {
      name: 'biweekly Friday × 3',
      frequency: {
        type: 'recurring',
        date: '2026-09-04',
        recurring: {
          every: 2,
          interval: 'week',
          repeatCount: 3,
          daysOfWeek: ['friday'],
        },
      },
      expectedDates: ['2026-09-04', '2026-09-18', '2026-10-02'],
    },
    {
      name: 'monthly dayOfMonth × 3',
      frequency: {
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'month',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          dayOfMonth: 10,
        },
      },
      expectedDates: ['2026-01-10', '2026-02-10', '2026-03-10'],
    },
    {
      name: 'every 2 months day 15 × 3',
      frequency: {
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 2,
          interval: 'month',
          repeatCount: 3,
          monthMode: 'dayOfMonth',
          dayOfMonth: 15,
        },
      },
      expectedDates: ['2026-01-15', '2026-03-15', '2026-05-15'],
    },
    {
      name: 'yearly dayOfMonth × 2',
      frequency: {
        type: 'recurring',
        date: '2026-01-01',
        recurring: {
          every: 1,
          interval: 'year',
          repeatCount: 2,
          monthMode: 'dayOfMonth',
          yearMonth: 'march',
          yearDay: 15,
        },
      },
      expectedDates: ['2026-03-15', '2027-03-15'],
    },
  ])('assigns tasks for frequency case: $name', async ({ frequency, expectedDates }) => {
    const created = await materialize(frequency);

    expect(created).toHaveLength(expectedDates.length);
    expect(created.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual(expectedDates);
    expect(created.every((a) => a.assigneeUserId === 101)).toBe(true);
    expect(
      created.every((a) =>
        [AssignmentStatus.PENDING, AssignmentStatus.OVERDUE].includes(a.status),
      ),
    ).toBe(true);

    // Occurrence keys are unique per due date × assignee × version.
    const keys = created.map((a) => a.occurrenceKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('assigns monthly On the Third Wednesday × 2', async () => {
    const created = await materialize({
      type: 'recurring',
      date: '2026-01-01',
      recurring: {
        every: 1,
        interval: 'month',
        repeatCount: 2,
        monthMode: 'onThe',
        weekOrder: 'third',
        daysOfWeek: ['wednesday'],
      },
    });

    expect(created.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-01-21',
      '2026-02-18',
    ]);
  });

  it('does not duplicate open tasks when rematerializing the same frequency', async () => {
    const frequency = {
      type: 'recurring',
      date: '2026-09-01',
      recurring: { every: 1, interval: 'day', repeatCount: 3 },
    };

    const first = await materialize(frequency, 20);
    expect(first).toHaveLength(3);

    // Existing open rows are returned as-is (idempotent).
    findOneMock.mockImplementation(async ({ where }: any) => {
      return (
        savedRows.find((row) => row.occurrenceKey === where.occurrenceKey) || null
      );
    });
    saveMock.mockClear();
    createMock.mockClear();

    const second = await materialize(frequency, 20);
    expect(second).toHaveLength(3);
    expect(createMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(second.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  it('assigns again on frequency change via a new template version', async () => {
    const daily = {
      type: 'recurring',
      date: '2026-09-01',
      recurring: { every: 1, interval: 'day', repeatCount: 3 },
    };
    const weekly = {
      type: 'recurring',
      date: '2026-09-01',
      recurring: { every: 1, interval: 'week', repeatCount: 2, daysOfWeek: [] },
    };

    const first = await materialize(daily, 20);
    expect(first.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);

    // New version → new occurrence keys → new assignment set (assign again).
    findOneMock.mockResolvedValue(null);
    savedRows = [];
    saveMock.mockClear();

    const second = await materialize(weekly, 21);
    expect(second.map((a) => a.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-01',
      '2026-09-08',
    ]);
    expect(second.every((a) => String(a.occurrenceKey).startsWith('10:21:'))).toBe(true);
    expect(second.every((a) => a.assigneeUserId === 101)).toBe(true);
  });

  it('assigns one task per assignee × occurrence for multi-user recurring', async () => {
    const template = {
      id: 10,
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
      template,
      { id: 20, schemaSnapshot: template.schema } as any,
      1,
    );

    expect(created).toHaveLength(4);
    expect(
      created.map((a) => `${a.assigneeUserId}:${a.dueAt.toISOString().slice(0, 10)}`).sort(),
    ).toEqual(['101:2026-09-01', '101:2026-09-02', '202:2026-09-01', '202:2026-09-02']);
  });

  it('does not backfill past overdue for a user added mid-schedule', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));

    // Template already running since Sept 16 for users 101 and 202.
    savedRows = [
      {
        id: 1,
        templateId: 10,
        assigneeUserId: 101,
        jobPositionId: null,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
      },
      {
        id: 2,
        templateId: 10,
        assigneeUserId: 202,
        jobPositionId: null,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
      },
    ];

    const template = {
      id: 10,
      schema: {
        assign: { mode: 'individual', users: [101, 202, 303], jobPosition: null },
        frequency: {
          type: 'recurring',
          date: '2026-09-16',
          recurring: { every: 1, interval: 'day', repeatCount: 10 },
        },
      },
    } as any;

    findOneMock.mockClear();
    saveMock.mockClear();
    createMock.mockClear();

    const created = await service.materializeFromTemplate(
      req,
      template,
      { id: 21, schemaSnapshot: template.schema } as any,
      1,
    );

    const forNewUser = created.filter((a) => a.assigneeUserId === 303);
    expect(forNewUser.length).toBeGreaterThan(0);
    expect(
      forNewUser.every((a) => a.dueAt.toISOString().slice(0, 10) >= '2026-09-23'),
    ).toBe(true);

    // Existing completed Sept 16 is reused (not cloned empty) after rematerialize.
    const forExisting = created.filter((a) => a.assigneeUserId === 101);
    const sept16 = forExisting.filter((a) => a.dueAt.toISOString().slice(0, 10) === '2026-09-16');
    expect(sept16).toHaveLength(1);
    expect(sept16[0].status).toBe(AssignmentStatus.COMPLETED);
    expect(sept16[0].id).toBe(1);

    jest.useRealTimers();
  });

  it('reuses completed occurrence across frequency rematerialize instead of empty clone', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-20T12:00:00.000Z'));

    savedRows = [
      {
        id: 50,
        templateId: 10,
        templateVersionId: 20,
        assigneeUserId: 101,
        jobPositionId: null,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
        occurrenceKey: '10:20:2026-09-16T00:00:00.000Z:u:101',
        completedAt: new Date('2026-09-16T10:00:00.000Z'),
        completedByUserId: 101,
      },
    ];

    const template = {
      id: 10,
      schema: {
        assign: { mode: 'individual', users: [101], jobPosition: null },
        frequency: {
          type: 'recurring',
          date: '2026-09-16',
          recurring: { every: 1, interval: 'day', repeatCount: 5 },
        },
      },
    } as any;

    const created = await service.materializeFromTemplate(
      req,
      template,
      { id: 21, schemaSnapshot: template.schema } as any,
      1,
    );

    const sept16 = created.filter((a) => a.dueAt.toISOString().slice(0, 10) === '2026-09-16');
    expect(sept16).toHaveLength(1);
    expect(sept16[0]).toMatchObject({
      id: 50,
      status: AssignmentStatus.COMPLETED,
      occurrenceKey: '10:20:2026-09-16T00:00:00.000Z:u:101',
    });
    // No new open row created for the already-completed day.
    expect(
      created.some(
        (a) =>
          a.dueAt.toISOString().slice(0, 10) === '2026-09-16' &&
          a.status !== AssignmentStatus.COMPLETED,
      ),
    ).toBe(false);

    jest.useRealTimers();
  });

  it('cancels false past overdue when mid-added user already has completed from assign day', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-23T12:00:00.000Z'));

    savedRows = [
      {
        id: 1,
        templateId: 10,
        assigneeUserId: 101,
        jobPositionId: null,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
      },
      // Bad backfill for user added on Sept 23:
      {
        id: 10,
        templateId: 10,
        assigneeUserId: 303,
        jobPositionId: null,
        dueAt: new Date('2026-09-17T00:00:00.000Z'),
        status: AssignmentStatus.OVERDUE,
      },
      {
        id: 11,
        templateId: 10,
        assigneeUserId: 303,
        jobPositionId: null,
        dueAt: new Date('2026-09-22T00:00:00.000Z'),
        status: AssignmentStatus.OVERDUE,
      },
      {
        id: 12,
        templateId: 10,
        assigneeUserId: 303,
        jobPositionId: null,
        dueAt: new Date('2026-09-23T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
      },
    ];

    const template = {
      id: 10,
      schema: {
        assign: { mode: 'individual', users: [101, 303], jobPosition: null },
        frequency: {
          type: 'recurring',
          date: '2026-09-16',
          recurring: { every: 1, interval: 'day', repeatCount: 10 },
        },
      },
    } as any;

    findOneMock.mockClear();
    const created = await service.materializeFromTemplate(
      req,
      template,
      { id: 22, schemaSnapshot: template.schema } as any,
      1,
    );

    expect(assignmentRepo.createQueryBuilder).toHaveBeenCalled();
    const forUser = created.filter((a) => a.assigneeUserId === 303);
    expect(forUser.every((a) => a.dueAt.toISOString().slice(0, 10) >= '2026-09-23')).toBe(
      true,
    );

    jest.useRealTimers();
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
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => {
        const api: any = {};
        for (const method of ['update', 'set', 'where', 'andWhere']) {
          api[method] = jest.fn().mockReturnValue(api);
        }
        api.execute = jest.fn().mockResolvedValue({ affected: 0 });
        return api;
      }),
    };
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity) => {
          if (entity?.name === 'User') {
            return {
              createQueryBuilder: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                addSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                getRawMany: jest.fn().mockResolvedValue([]),
              })),
            };
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

    // Today is a due-day filter, not a status — cancelled still belong on the cancelled tab.
    expect(andWhereMock).toHaveBeenCalledWith('assignment.status != :cancelledStatus', {
      cancelledStatus: AssignmentStatus.CANCELLED,
    });

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

describe('AssignmentsService findAssignedForms (admin board)', () => {
  let service: AssignmentsService;
  let listQb: any;
  let statsQb: any;
  let boardQb: any;
  let createQueryBuilderMock: jest.Mock;
  let findUsersMock: jest.Mock;
  let findSubmissionsMock: jest.Mock;
  let findAssignmentsMock: jest.Mock;
  let findVersionsMock: jest.Mock;
  let countTemplatesMock: jest.Mock;
  let req: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-16T12:00:00.000Z'));

    const chain = () => {
      const api: any = {};
      for (const method of [
        'leftJoinAndSelect',
        'innerJoinAndSelect',
        'innerJoin',
        'leftJoin',
        'andWhere',
        'orderBy',
        'addOrderBy',
        'skip',
        'take',
        'select',
        'addSelect',
        'groupBy',
      ]) {
        api[method] = jest.fn().mockReturnValue(api);
      }
      return api;
    };

    listQb = chain();
    listQb.getMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        templateId: 10,
        templateVersionId: 12,
        assigneeUserId: 5,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
        assignmentType: 'shared',
        sharedGroupKey: 'shared-1',
        completedByUserId: 5,
        completedAt: new Date('2026-09-16T14:10:00.000Z'),
        template: {
          id: 10,
          name: 'Daily Kitchen Checklist',
          schema: {
            formName: 'Daily Kitchen Checklist',
            frequency: {
              type: 'recurring',
              date: '2026-09-16',
              recurring: { every: 1, interval: 'day', repeatCount: 1 },
            },
            sections: [],
          },
          status: 'active',
          isActive: true,
        },
        createdAt: new Date('2026-09-15T01:00:00.000Z'),
        updatedAt: new Date('2026-09-16T14:10:00.000Z'),
      },
      {
        id: 3,
        templateId: 10,
        templateVersionId: 12,
        assigneeUserId: 9,
        dueAt: new Date('2026-09-16T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
        assignmentType: 'shared',
        sharedGroupKey: 'shared-1',
        completedByUserId: 5,
        completedAt: new Date('2026-09-16T14:10:00.000Z'),
        template: {
          id: 10,
          name: 'Daily Kitchen Checklist',
          schema: {
            formName: 'Daily Kitchen Checklist',
            frequency: {
              type: 'recurring',
              date: '2026-09-16',
              recurring: { every: 1, interval: 'day', repeatCount: 1 },
            },
            sections: [],
          },
          status: 'active',
          isActive: true,
        },
        createdAt: new Date('2026-09-15T01:00:00.000Z'),
        updatedAt: new Date('2026-09-16T14:10:00.000Z'),
      },
      {
        id: 2,
        templateId: 11,
        templateVersionId: 13,
        assigneeUserId: 6,
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        status: AssignmentStatus.OVERDUE,
        assignmentType: 'individual',
        sharedGroupKey: null,
        completedByUserId: null,
        completedAt: null,
        template: {
          id: 11,
          name: 'Hygiene Inspection',
          schema: {
            frequency: {
              type: 'recurring',
              date: '2026-09-01',
              recurring: { every: 1, interval: 'month', repeatCount: 12, monthMode: 'dayOfMonth', dayOfMonth: 1 },
            },
          },
          status: 'active',
          isActive: true,
        },
        createdAt: new Date('2026-09-14T01:00:00.000Z'),
        updatedAt: new Date('2026-09-15T01:00:00.000Z'),
      },
      {
        id: 4,
        templateId: 11,
        templateVersionId: 13,
        assigneeUserId: 6,
        dueAt: new Date('2026-10-01T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
        assignmentType: 'individual',
        sharedGroupKey: null,
        completedByUserId: null,
        completedAt: null,
        template: {
          id: 11,
          name: 'Hygiene Inspection',
          schema: {
            frequency: {
              type: 'recurring',
              date: '2026-09-01',
              recurring: { every: 1, interval: 'month', repeatCount: 12, monthMode: 'dayOfMonth', dayOfMonth: 1 },
            },
          },
          status: 'active',
          isActive: true,
        },
        createdAt: new Date('2026-09-14T01:00:00.000Z'),
        updatedAt: new Date('2026-09-14T01:00:00.000Z'),
      },
    ]);

    statsQb = chain();
    statsQb.getRawMany = jest.fn().mockResolvedValue([
      { status: AssignmentStatus.COMPLETED, count: '16' },
      { status: AssignmentStatus.IN_PROGRESS, count: '5' },
      { status: AssignmentStatus.OVERDUE, count: '3' },
    ]);

    boardQb = chain();
    // Board cards use the same fixture rows (independent of list status filter).
    boardQb.getMany = jest.fn().mockImplementation(() => listQb.getMany());

    createQueryBuilderMock = jest
      .fn()
      .mockImplementationOnce(() => listQb)
      .mockImplementation(() => {
        const api: any = chain();
        api.getMany = boardQb.getMany;
        api.getRawMany = statsQb.getRawMany;
        return api;
      });

    countTemplatesMock = jest.fn().mockResolvedValue(6);

    findUsersMock = jest.fn().mockResolvedValue([
      { id: 5, name: 'Sarah Johnson' },
      { id: 9, name: 'Alex Kim' },
      { id: 6, name: 'Mike Chen' },
    ]);
    findSubmissionsMock = jest.fn().mockResolvedValue([
      {
        id: 40,
        assignmentId: 1,
        templateVersionId: 12,
        submittedBy: 5,
        answers: { fld_001: 'ok' },
        status: 'submitted',
        submittedAt: new Date('2026-09-16T14:10:00.000Z'),
        createdBy: 5,
        updatedBy: 5,
        createdAt: new Date('2026-09-16T13:00:00.000Z'),
        updatedAt: new Date('2026-09-16T14:10:00.000Z'),
      },
    ]);
    findAssignmentsMock = jest.fn().mockResolvedValue([
      { id: 1, sharedGroupKey: 'shared-1', assigneeUserId: 5 },
      { id: 3, sharedGroupKey: 'shared-1', assigneeUserId: 9 },
    ]);
    findVersionsMock = jest.fn().mockResolvedValue([
      {
        id: 12,
        templateId: 10,
        schemaSnapshot: {
          formName: 'Daily Kitchen Checklist',
          sections: [{ id: 'sec_1', fields: [{ id: 'fld_001', label: 'Notes' }] }],
        },
      },
    ]);

    service = new AssignmentsService(new FrequencyService());
    req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: jest.fn((entity: any) => {
          if (entity?.name === 'DataCollectionAssignment') {
            return {
              createQueryBuilder: createQueryBuilderMock,
              find: findAssignmentsMock,
            };
          }
          if (entity?.name === 'DataCollectionTemplate') {
            return { count: countTemplatesMock };
          }
          if (entity?.name === 'User') {
            return { find: findUsersMock };
          }
          if (entity?.name === 'DataCollectionSubmission') {
            return { find: findSubmissionsMock };
          }
          if (entity?.name === 'TemplateVersion') {
            return { find: findVersionsMock };
          }
          return { createQueryBuilder: createQueryBuilderMock, find: jest.fn().mockResolvedValue([]) };
        }),
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('groups recurring series with progress counts, frequency, and next due', async () => {
    const result = await service.findAssignedForms(req, { page: 1, limit: 5 });

    expect(listQb.orderBy).toHaveBeenCalledWith('assignment.dueAt', 'ASC');
    expect(listQb.addOrderBy).toHaveBeenCalledWith('assignment.id', 'ASC');
    expect(listQb.getMany).toHaveBeenCalled();
    expect(listQb.andWhere).toHaveBeenCalledWith('template.status = :assignedFormsTemplateStatus', {
      assignedFormsTemplateStatus: 'active',
    });
    expect(listQb.andWhere).toHaveBeenCalledWith('template.is_active = :assignedFormsTemplateIsActive', {
      assignedFormsTemplateIsActive: true,
    });
    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      level: 'occurrence',
      totalAssigned: 24,
      completed: 16,
      inProgress: 5,
      overdue: 3,
      notStarted: 0,
    });
    expect(countTemplatesMock).toHaveBeenCalledWith({
      where: { status: 'active', isActive: true },
    });
    expect(result.assignmentStats).toEqual({
      level: 'assignment',
      totalAssigned: 6,
      withOverdue: 1,
      withInProgress: 0,
      fullyCompleted: 1,
    });
    // 2 series: shared template 10 + individual template 11 for user 6
    expect(result.meta).toEqual({ total: 2, page: 1, lastPage: 1, limit: 5 });
    expect(result.data).toHaveLength(2);

    const shared = result.data.find((row: any) => row.templateId === 10);
    expect(shared).toBeDefined();
    expect(shared).toMatchObject({
      formName: 'Daily Kitchen Checklist',
      mode: 'shared',
      frequencyLabel: 'Daily',
      assigneeUserIds: [5, 9],
      assignedTo: [
        { id: 5, name: 'Sarah Johnson' },
        { id: 9, name: 'Alex Kim' },
      ],
      completed: 1,
      inProgress: 0,
      overdue: 0,
      progress: {
        total: 1,
        completed: 1,
        inProgress: 0,
        overdue: 0,
      },
      occurrences: { count: 1, label: '1 completed' },
      status: AssignmentStatus.COMPLETED,
      statusLabel: 'Completed',
    });

    const individual = result.data.find((row: any) => row.templateId === 11);
    expect(individual).toBeDefined();
    expect(individual).toMatchObject({
      formName: 'Hygiene Inspection',
      assignedTo: [{ id: 6, name: 'Mike Chen' }],
      frequencyLabel: 'Monthly · 1st',
      nextDueLabel: 'Oct 1, 2026',
      status: AssignmentStatus.PENDING,
      statusLabel: 'Not Started',
      completed: 0,
      inProgress: 0,
      overdue: 1,
      progress: {
        total: 2,
        completed: 0,
        inProgress: 0,
        overdue: 1,
        pending: 1,
      },
      occurrenceCount: 2,
      occurrences: { count: 2, label: '2 upcoming' },
    });
  });

  it('filters by status not_started as pending and applies search', async () => {
    await service.findAssignedForms(req, {
      page: 1,
      limit: 15,
      status: 'not_started',
      search: 'Kitchen',
    });

    expect(listQb.andWhere).toHaveBeenCalledWith('assignment.status = :status', {
      status: AssignmentStatus.PENDING,
    });
    const searchCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('ILIKE :search'),
    );
    expect(searchCall).toBeDefined();
    expect(searchCall[1].search).toBe('%Kitchen%');
  });

  it('filters overdue, due range, and recent submissions', async () => {
    await service.findAssignedForms(req, {
      page: 1,
      limit: 15,
      status: AssignmentStatus.OVERDUE,
      dueFrom: '2026-09-01',
      dueTo: '2026-09-30',
      recentSubmissions: true,
      recentDays: 7,
    });

    expect(listQb.andWhere).toHaveBeenCalledWith('assignment.status = :status', {
      status: AssignmentStatus.OVERDUE,
    });
    expect(listQb.andWhere).toHaveBeenCalledWith('assignment.dueAt >= :dueFrom', {
      dueFrom: new Date('2026-09-01T00:00:00.000Z'),
    });
    expect(listQb.andWhere).toHaveBeenCalledWith('assignment.dueAt <= :dueTo', {
      dueTo: new Date('2026-09-30T23:59:59.999Z'),
    });
    const recentCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('dc_submissions'),
    );
    expect(recentCall).toBeDefined();
  });

  it('filters by multiple userId and jobPositionId values', async () => {
    await service.findAssignedForms(req, {
      page: 1,
      limit: 15,
      userId: [4, 8],
      jobPositionId: [5, 6],
    });

    const userCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('assignedFormsUserIds'),
    );
    expect(userCall).toBeDefined();
    expect(userCall[1].assignedFormsUserIds).toEqual([4, 8]);

    const jpCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('assignedFormsJobPositionIds'),
    );
    expect(jpCall).toBeDefined();
    expect(jpCall[1].assignedFormsJobPositionIds).toEqual([5, 6]);
  });

  it('merges legacy assigneeUserId into userId filter', async () => {
    await service.findAssignedForms(req, {
      page: 1,
      limit: 15,
      userId: [4],
      assigneeUserId: 9,
    });

    const userCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('assignedFormsUserIds'),
    );
    expect(userCall[1].assignedFormsUserIds.sort()).toEqual([4, 9]);
  });

  it('filters by responseStatus flagged/failed via submission EXISTS', async () => {
    await service.findAssignedForms(req, {
      page: 1,
      limit: 15,
      responseStatus: [SubmissionStatus.FLAGGED, SubmissionStatus.FAILED],
    });

    const responseCall = listQb.andWhere.mock.calls.find(([sql]: [string]) =>
      String(sql).includes('assignedFormsResponseStatuses'),
    );
    expect(responseCall).toBeDefined();
    expect(responseCall[1].assignedFormsResponseStatuses).toEqual([
      SubmissionStatus.FLAGGED,
      SubmissionStatus.FAILED,
    ]);
  });

  it('rejects invalid dueFrom', async () => {
    await expect(
      service.findAssignedForms(req, { dueFrom: '09-01-2026' as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns assignment summary + month-scoped occurrences for View Details', async () => {
    const seed = {
      id: 4,
      templateId: 11,
      templateVersionId: 13,
      assigneeUserId: 6,
      jobPositionId: null,
      dueAt: new Date('2026-10-01T00:00:00.000Z'),
      status: AssignmentStatus.PENDING,
      assignmentType: 'individual',
      sharedGroupKey: null,
      template: {
        id: 11,
        name: 'Hygiene Inspection',
        schema: {
          frequency: {
            type: 'recurring',
            date: '2026-09-01',
            recurring: {
              every: 1,
              interval: 'month',
              repeatCount: 12,
              monthMode: 'dayOfMonth',
              dayOfMonth: 1,
            },
          },
        },
        status: 'active',
        isActive: true,
      },
      createdAt: new Date('2026-09-14T01:00:00.000Z'),
      updatedAt: new Date('2026-09-14T01:00:00.000Z'),
    };

    const detailRows = [
      {
        ...seed,
        id: 2,
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        status: AssignmentStatus.OVERDUE,
      },
      {
        ...seed,
        id: 4,
        dueAt: new Date('2026-10-01T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
      },
    ];

    const detailQb: any = {};
    for (const method of [
      'leftJoinAndSelect',
      'andWhere',
      'orderBy',
      'addOrderBy',
    ]) {
      detailQb[method] = jest.fn().mockReturnValue(detailQb);
    }
    detailQb.getMany = jest.fn().mockResolvedValue(detailRows);

    const findOneMock = jest.fn().mockResolvedValue(seed);
    createQueryBuilderMock.mockReset();
    createQueryBuilderMock.mockReturnValue(detailQb);

    req.tenantConnection.getRepository = jest.fn((entity: any) => {
      if (entity?.name === 'DataCollectionAssignment') {
        return {
          createQueryBuilder: createQueryBuilderMock,
          find: findAssignmentsMock,
          findOne: findOneMock,
        };
      }
      if (entity?.name === 'User') {
        return { find: findUsersMock };
      }
      if (entity?.name === 'DataCollectionSubmission') {
        return { find: findSubmissionsMock };
      }
      if (entity?.name === 'TemplateVersion') {
        return { find: findVersionsMock };
      }
      return { createQueryBuilder: createQueryBuilderMock, find: jest.fn().mockResolvedValue([]) };
    });

    const result = await service.findAssignedFormDetail(req, 4, { month: '2026-09' });

    expect(findOneMock).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.assignment.summary).toMatchObject({
      formName: 'Hygiene Inspection',
      frequencyLabel: 'Monthly · 1st',
      totalOccurrences: 2,
      overdue: 1,
      pending: 1,
    });
    expect(result.data.occurrences.meta).toMatchObject({
      month: '2026-09',
      total: 1,
      status: 'all',
      responseStatus: null,
    });
    expect(result.data.occurrences.data).toHaveLength(1);
    expect(result.data.occurrences.data[0]).toMatchObject({
      id: 2,
      status: AssignmentStatus.OVERDUE,
      statusLabel: 'Overdue',
      action: 'open',
    });

    const byDate = await service.findAssignedFormDetail(req, 4, { date: '2026-09-15' });
    expect(byDate.data.occurrences.meta).toMatchObject({
      date: '2026-09-15',
      dueFrom: '2026-09-15',
      dueTo: '2026-09-15',
      total: 1,
    });
    expect(byDate.data.occurrences.data[0].id).toBe(2);

    // No range params → assign start (min dueAt) through today+1.
    const byDefault = await service.findAssignedFormDetail(req, 4, {});
    expect(byDefault.data.occurrences.meta).toMatchObject({
      dueFrom: '2026-09-15',
      dueTo: '2026-09-17',
      month: null,
      date: null,
      total: 1,
    });
    expect(byDefault.data.occurrences.data[0].id).toBe(2);
  });

  it('filters View Details occurrences by responseStatus', async () => {
    const seed = {
      id: 2,
      templateId: 11,
      templateVersionId: 13,
      assigneeUserId: 6,
      jobPositionId: null,
      dueAt: new Date('2026-09-15T00:00:00.000Z'),
      status: AssignmentStatus.COMPLETED,
      assignmentType: 'individual',
      sharedGroupKey: null,
      completedByUserId: 6,
      completedAt: new Date('2026-09-15T10:00:00.000Z'),
      template: {
        id: 11,
        name: 'Hygiene Inspection',
        schema: {
          frequency: {
            type: 'recurring',
            date: '2026-09-01',
            recurring: {
              every: 1,
              interval: 'month',
              repeatCount: 12,
              monthMode: 'dayOfMonth',
              dayOfMonth: 1,
            },
          },
        },
        status: 'active',
        isActive: true,
      },
      createdAt: new Date('2026-09-14T01:00:00.000Z'),
      updatedAt: new Date('2026-09-15T10:00:00.000Z'),
    };

    const detailRows = [
      {
        ...seed,
        id: 2,
        dueAt: new Date('2026-09-15T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
      },
      {
        ...seed,
        id: 5,
        dueAt: new Date('2026-09-20T00:00:00.000Z'),
        status: AssignmentStatus.COMPLETED,
        completedAt: new Date('2026-09-20T11:00:00.000Z'),
      },
    ];

    const detailQb: any = {};
    for (const method of [
      'leftJoinAndSelect',
      'andWhere',
      'orderBy',
      'addOrderBy',
    ]) {
      detailQb[method] = jest.fn().mockReturnValue(detailQb);
    }
    detailQb.getMany = jest.fn().mockResolvedValue(detailRows);

    const findOneMock = jest.fn().mockResolvedValue(seed);
    createQueryBuilderMock.mockReset();
    createQueryBuilderMock.mockReturnValue(detailQb);

    findSubmissionsMock.mockResolvedValue([
      {
        id: 50,
        assignmentId: 2,
        templateVersionId: 13,
        submittedBy: 6,
        answers: { fld_001: 'flagged' },
        status: SubmissionStatus.FLAGGED,
        submittedAt: new Date('2026-09-15T10:00:00.000Z'),
        createdBy: 6,
        updatedBy: 6,
        createdAt: new Date('2026-09-15T09:00:00.000Z'),
        updatedAt: new Date('2026-09-15T10:00:00.000Z'),
      },
      {
        id: 51,
        assignmentId: 5,
        templateVersionId: 13,
        submittedBy: 6,
        answers: { fld_001: 'ok' },
        status: SubmissionStatus.APPROVED,
        submittedAt: new Date('2026-09-20T11:00:00.000Z'),
        createdBy: 6,
        updatedBy: 6,
        createdAt: new Date('2026-09-20T10:00:00.000Z'),
        updatedAt: new Date('2026-09-20T11:00:00.000Z'),
      },
    ]);

    req.tenantConnection.getRepository = jest.fn((entity: any) => {
      if (entity?.name === 'DataCollectionAssignment') {
        return {
          createQueryBuilder: createQueryBuilderMock,
          find: findAssignmentsMock,
          findOne: findOneMock,
        };
      }
      if (entity?.name === 'User') {
        return { find: findUsersMock };
      }
      if (entity?.name === 'DataCollectionSubmission') {
        return { find: findSubmissionsMock };
      }
      if (entity?.name === 'TemplateVersion') {
        return { find: findVersionsMock };
      }
      return { createQueryBuilder: createQueryBuilderMock, find: jest.fn().mockResolvedValue([]) };
    });

    const result = await service.findAssignedFormDetail(req, 2, {
      month: '2026-09',
      responseStatus: [SubmissionStatus.FLAGGED, SubmissionStatus.FAILED],
    });

    expect(result.data.occurrences.meta).toMatchObject({
      month: '2026-09',
      total: 1,
      responseStatus: [SubmissionStatus.FLAGGED, SubmissionStatus.FAILED],
    });
    expect(result.data.occurrences.data).toHaveLength(1);
    expect(result.data.occurrences.data[0].id).toBe(2);
  });

  it('attaches shared submission when occurrence row is a non-submitter peer', async () => {
    const template = {
      id: 9,
      name: 'Daily Kitchen Checklist',
      schema: {
        formName: 'Daily Kitchen Checklist',
        frequency: {
          type: 'recurring',
          date: '2026-09-16',
          recurring: { every: 1, interval: 'day', repeatCount: 1 },
        },
      },
      status: 'active',
      isActive: true,
    };

    // Representative historically preferred lowest id (Lee Hunt) who did not submit.
    const peerViewer = {
      id: 9,
      templateId: 9,
      templateVersionId: 13,
      assigneeUserId: 2,
      jobPositionId: null,
      dueAt: new Date('2026-09-16T00:00:00.000Z'),
      status: AssignmentStatus.COMPLETED,
      assignmentType: 'shared',
      sharedGroupKey: '9:13:2026-09-16T00:00:00.000Z:shared',
      completedByUserId: 5,
      completedAt: new Date('2026-09-16T14:30:33.236Z'),
      template,
      createdAt: new Date('2026-09-16T01:00:00.000Z'),
      updatedAt: new Date('2026-09-16T14:30:33.236Z'),
    };
    const peerSubmitter = {
      ...peerViewer,
      id: 12,
      assigneeUserId: 5,
    };

    const detailQb: any = {};
    for (const method of ['leftJoinAndSelect', 'andWhere', 'orderBy', 'addOrderBy']) {
      detailQb[method] = jest.fn().mockReturnValue(detailQb);
    }
    detailQb.getMany = jest.fn().mockResolvedValue([peerViewer, peerSubmitter]);

    const findOneMock = jest.fn().mockResolvedValue(peerViewer);
    createQueryBuilderMock.mockReset();
    createQueryBuilderMock.mockReturnValue(detailQb);

    findAssignmentsMock.mockImplementation(async (opts: any) => {
      const where = opts?.where || {};
      if (where.sharedGroupKey) {
        const keys = Array.isArray(where.sharedGroupKey)
          ? where.sharedGroupKey
          : where.sharedGroupKey?.value || [where.sharedGroupKey];
        const keyList = Array.isArray(keys) ? keys : [keys];
        return [peerViewer, peerSubmitter].filter((row) =>
          keyList.some((k: any) => String(k).includes('9:13') || k === row.sharedGroupKey),
        );
      }
      if (where.status === AssignmentStatus.COMPLETED || where.status === 'completed') {
        return [peerViewer, peerSubmitter];
      }
      return [peerViewer, peerSubmitter];
    });

    findSubmissionsMock.mockResolvedValue([
      {
        id: 99,
        assignmentId: 12,
        templateVersionId: 13,
        submittedBy: 5,
        answers: { fld_shift: 'Morning' },
        status: 'submitted',
        submittedAt: new Date('2026-09-16T14:30:33.236Z'),
        createdBy: 5,
        updatedBy: 5,
        createdAt: new Date('2026-09-16T14:30:33.236Z'),
        updatedAt: new Date('2026-09-16T14:30:33.236Z'),
      },
    ]);
    findUsersMock.mockResolvedValue([
      { id: 2, name: 'Lee Hunt' },
      { id: 5, name: 'Eleanor Mayoo' },
    ]);
    findVersionsMock.mockResolvedValue([
      {
        id: 13,
        templateId: 9,
        schemaSnapshot: template.schema,
      },
    ]);

    req.tenantConnection.getRepository = jest.fn((entity: any) => {
      if (entity?.name === 'DataCollectionAssignment') {
        return {
          createQueryBuilder: createQueryBuilderMock,
          find: findAssignmentsMock,
          findOne: findOneMock,
        };
      }
      if (entity?.name === 'User') {
        return { find: findUsersMock };
      }
      if (entity?.name === 'DataCollectionSubmission') {
        return { find: findSubmissionsMock };
      }
      if (entity?.name === 'TemplateVersion') {
        return { find: findVersionsMock };
      }
      return { createQueryBuilder: createQueryBuilderMock, find: jest.fn().mockResolvedValue([]) };
    });

    const result = await service.findAssignedFormDetail(req, 9, { date: '2026-09-16' });
    const occurrence = result.data.occurrences.data[0];

    // Prefer submitter peer as representative when collapsing the shared due day.
    expect(occurrence.id).toBe(12);
    expect(occurrence.submissionId).toBe(99);
    expect(occurrence.submission).toMatchObject({
      id: 99,
      answers: { fld_shift: 'Morning' },
    });
  });

  it('paginates all upcoming occurrences when status=upcoming (no default date window)', async () => {
    jest.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));

    const template = {
      id: 12,
      name: 'Template 1',
      schema: {
        formName: 'Template 1',
        frequency: {
          type: 'recurring',
          date: '2026-09-25',
          recurring: { every: 1, interval: 'day', repeatCount: 5 },
        },
      },
      status: 'active',
      isActive: true,
    };

    const seed = {
      id: 100,
      templateId: 12,
      templateVersionId: 40,
      assigneeUserId: 7,
      jobPositionId: null,
      dueAt: new Date('2026-09-25T00:00:00.000Z'),
      status: AssignmentStatus.COMPLETED,
      assignmentType: 'shared',
      sharedGroupKey: '12:40:2026-09-25T00:00:00.000Z:shared',
      completedByUserId: 7,
      completedAt: new Date('2026-09-25T10:00:00.000Z'),
      template,
      createdAt: new Date('2026-09-25T01:00:00.000Z'),
      updatedAt: new Date('2026-09-25T10:00:00.000Z'),
    };

    const detailRows = [
      seed,
      {
        ...seed,
        id: 101,
        dueAt: new Date('2026-09-26T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
        sharedGroupKey: '12:40:2026-09-26T00:00:00.000Z:shared',
        completedByUserId: null,
        completedAt: null,
      },
      {
        ...seed,
        id: 102,
        dueAt: new Date('2026-09-27T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
        sharedGroupKey: '12:40:2026-09-27T00:00:00.000Z:shared',
        completedByUserId: null,
        completedAt: null,
      },
      {
        ...seed,
        id: 103,
        dueAt: new Date('2026-09-28T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
        sharedGroupKey: '12:40:2026-09-28T00:00:00.000Z:shared',
        completedByUserId: null,
        completedAt: null,
      },
      {
        ...seed,
        id: 104,
        dueAt: new Date('2026-09-29T00:00:00.000Z'),
        status: AssignmentStatus.PENDING,
        sharedGroupKey: '12:40:2026-09-29T00:00:00.000Z:shared',
        completedByUserId: null,
        completedAt: null,
      },
    ];

    const detailQb: any = {};
    for (const method of ['leftJoinAndSelect', 'andWhere', 'orderBy', 'addOrderBy']) {
      detailQb[method] = jest.fn().mockReturnValue(detailQb);
    }
    detailQb.getMany = jest.fn().mockResolvedValue(detailRows);

    const findOneMock = jest.fn().mockResolvedValue(seed);
    createQueryBuilderMock.mockReset();
    createQueryBuilderMock.mockReturnValue(detailQb);
    findSubmissionsMock.mockResolvedValue([]);
    findAssignmentsMock.mockResolvedValue([]);
    findUsersMock.mockResolvedValue([{ id: 7, name: 'Cyrus Mccarty' }]);
    findVersionsMock.mockResolvedValue([]);

    req.tenantConnection.getRepository = jest.fn((entity: any) => {
      if (entity?.name === 'DataCollectionAssignment') {
        return {
          createQueryBuilder: createQueryBuilderMock,
          find: findAssignmentsMock,
          findOne: findOneMock,
        };
      }
      if (entity?.name === 'User') {
        return { find: findUsersMock };
      }
      if (entity?.name === 'DataCollectionSubmission') {
        return { find: findSubmissionsMock };
      }
      if (entity?.name === 'TemplateVersion') {
        return { find: findVersionsMock };
      }
      return { createQueryBuilder: createQueryBuilderMock, find: jest.fn().mockResolvedValue([]) };
    });

    const page1 = await service.findAssignedFormDetail(req, 100, {
      page: 1,
      limit: 2,
      status: 'upcoming',
    });

    expect(page1.data.occurrences.meta).toMatchObject({
      total: 4,
      page: 1,
      lastPage: 2,
      limit: 2,
      status: 'upcoming',
      dueFrom: '2026-09-25',
      dueTo: '2026-09-29',
    });
    expect(page1.data.occurrences.data).toHaveLength(2);
    expect(page1.data.occurrences.data.map((row: any) => row.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-26',
      '2026-09-27',
    ]);

    const page2 = await service.findAssignedFormDetail(req, 100, {
      page: 2,
      limit: 2,
      status: 'upcoming',
    });
    expect(page2.data.occurrences.data.map((row: any) => row.dueAt.toISOString().slice(0, 10))).toEqual([
      '2026-09-28',
      '2026-09-29',
    ]);
  });
});
