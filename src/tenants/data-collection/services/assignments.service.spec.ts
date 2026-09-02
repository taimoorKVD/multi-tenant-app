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
