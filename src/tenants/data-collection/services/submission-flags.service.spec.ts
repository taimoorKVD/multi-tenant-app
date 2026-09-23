import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SubmissionFlagsService } from './submission-flags.service';
import {
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionSubmissionFlag,
  DataCollectionSubmissionReviewEvent,
  TemplateVersion,
} from '../entities';
import { User } from '../../users/entities';

function buildFlagServiceHarness(options?: {
  permissions?: string[];
  actorId?: number;
  submission?: any;
  assignment?: any;
  version?: any;
  flags?: any[];
}) {
  const actorId = options?.actorId ?? 42;
  const permissions = options?.permissions ?? ['complete-dc-assignment'];
  const submission = {
    id: 125,
    assignmentId: 5,
    templateVersionId: 6,
    status: 'draft',
    updatedBy: null,
    ...options?.submission,
  } as DataCollectionSubmission;

  const assignment = {
    id: 5,
    assigneeUserId: actorId,
    assignmentType: 'individual',
    sharedGroupKey: null,
    ...options?.assignment,
  } as DataCollectionAssignment;

  const version = {
    id: 6,
    schemaSnapshot: {
      sections: [
        {
          rows: [
            {
              fields: [
                { id: 'temperature', label: 'Temp' },
                { id: 'fld_001', label: 'Notes' },
              ],
            },
          ],
        },
      ],
    },
    ...options?.version,
  } as TemplateVersion;

  const flags = options?.flags ?? [];

  const savedFlags: any[] = [];
  const savedEvents: any[] = [];
  const savedSubmissions: any[] = [];

  const flagRepo = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      const saved = { id: savedFlags.length + 1, createdAt: new Date('2026-09-23T10:15:00Z'), ...row };
      savedFlags.push(saved);
      return saved;
    }),
    find: jest.fn(async () => flags),
    findOne: jest.fn(async ({ where }: any) => {
      return (
        flags.find(
          (f) =>
            f.id === where.id &&
            (where.submissionId == null || f.submissionId === where.submissionId),
        ) || null
      );
    }),
    count: jest.fn(async ({ where }: any) =>
      flags.filter(
        (f) =>
          f.submissionId === where.submissionId &&
          (where.isResolved == null || f.isResolved === where.isResolved),
      ).length,
    ),
  };

  const submissionRepo = {
    findOne: jest.fn(async () => submission),
    save: jest.fn(async (row) => {
      savedSubmissions.push(row);
      return row;
    }),
  };

  const assignmentRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id != null && where.id === assignment.id) return assignment;
      if (
        where.sharedGroupKey &&
        where.assigneeUserId === actorId &&
        assignment.sharedGroupKey === where.sharedGroupKey
      ) {
        return { ...assignment, assigneeUserId: actorId };
      }
      if (where.assigneeUserId != null && where.assigneeUserId !== assignment.assigneeUserId) {
        return null;
      }
      return assignment;
    }),
  };

  const versionRepo = {
    findOne: jest.fn(async () => version),
  };

  const eventRepo = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => {
      savedEvents.push(row);
      return row;
    }),
  };

  const userRepo = {
    find: jest.fn(async () => [{ id: actorId, name: 'John' }, { id: 99, name: 'Manager' }]),
  };

  const manager = {
    getRepository: (entity: any) => {
      if (entity === DataCollectionSubmission) return submissionRepo;
      if (entity === DataCollectionSubmissionFlag) return flagRepo;
      if (entity === TemplateVersion) return versionRepo;
      if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
      return {};
    },
    transaction: jest.fn(async (cb: Function) => cb(manager)),
  };

  const req = {
    user: { id: actorId, permissions },
    tenantConnection: {
      manager,
      getRepository: (entity: any) => {
        if (entity === DataCollectionSubmission) return submissionRepo;
        if (entity === DataCollectionSubmissionFlag) return flagRepo;
        if (entity === DataCollectionAssignment) return assignmentRepo;
        if (entity === TemplateVersion) return versionRepo;
        if (entity === User) return userRepo;
        if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
        return {};
      },
    },
  };

  const service = new SubmissionFlagsService();
  return {
    service,
    req,
    submission,
    assignment,
    flagRepo,
    submissionRepo,
    assignmentRepo,
    versionRepo,
    savedFlags,
    savedEvents,
    savedSubmissions,
  };
}

describe('SubmissionFlagsService', () => {
  it('employee can create a field-level flag', async () => {
    const { service, req, savedFlags } = buildFlagServiceHarness();

    const result = await service.create(req, 125, {
      fieldId: 'temperature',
      reason: 'Temperature seems unusually high.',
      severity: 'high' as any,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      submissionId: 125,
      fieldId: 'temperature',
      reason: 'Temperature seems unusually high.',
      severity: 'high',
      isResolved: false,
      createdBy: { id: 42, name: 'John' },
    });
    expect(savedFlags).toHaveLength(1);
  });

  it('employee can create a response-level flag with null fieldId', async () => {
    const { service, req } = buildFlagServiceHarness();

    const result = await service.create(req, 125, {
      fieldId: null,
      reason: 'Several values require investigation.',
    });

    expect(result.data.fieldId).toBeNull();
    expect(result.data.severity).toBe('medium');
  });

  it('manager can create field and response flags', async () => {
    const { service, req } = buildFlagServiceHarness({
      permissions: ['review-dc-submission'],
      actorId: 99,
      assignment: { assigneeUserId: 42 },
    });

    const field = await service.create(req, 125, {
      fieldId: 'temperature',
      reason: 'Manager field flag',
      severity: 'critical' as any,
    });
    const response = await service.create(req, 125, {
      reason: 'Manager response flag',
    });

    expect(field.data.fieldId).toBe('temperature');
    expect(response.data.fieldId).toBeNull();
  });

  it('rejects invalid field id against pinned version', async () => {
    const { service, req } = buildFlagServiceHarness();

    await expect(
      service.create(req, 125, {
        fieldId: 'not_a_real_field',
        reason: 'bad',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not validate against a newer template version', async () => {
    const { service, req, versionRepo } = buildFlagServiceHarness({
      version: {
        id: 6,
        schemaSnapshot: {
          sections: [{ rows: [{ fields: [{ id: 'temperature' }] }] }],
        },
      } as any,
    });

    // Even if a "latest" version would have other fields, we only load pinned version id 6.
    (versionRepo.findOne as jest.Mock).mockImplementation(async (args: any) => {
      expect(args.where.id).toBe(6);
      return {
        id: 6,
        schemaSnapshot: {
          sections: [{ rows: [{ fields: [{ id: 'temperature' }] }] }],
        },
      };
    });

    await expect(
      service.create(req, 125, { fieldId: 'new_field_only_in_v7', reason: 'x' }),
    ).rejects.toThrow(/does not exist on the pinned template version/);
  });

  it('moves submitted → flagged when a flag is added', async () => {
    const { service, req, savedSubmissions, savedEvents } = buildFlagServiceHarness({
      permissions: ['review-dc-submission'],
      submission: { status: 'submitted' },
    });

    await service.create(req, 125, {
      fieldId: 'temperature',
      reason: 'Needs review',
      severity: 'high' as any,
    });

    expect(savedSubmissions[0].status).toBe('flagged');
    expect(savedEvents.some((e) => e.action === 'flagged')).toBe(true);
  });

  it('keeps flagged status when another flag is added', async () => {
    const { service, req, savedSubmissions } = buildFlagServiceHarness({
      permissions: ['review-dc-submission'],
      submission: { status: 'flagged' },
    });

    await service.create(req, 125, { reason: 'Another issue' });
    expect(savedSubmissions).toHaveLength(0);
  });

  it('employee cannot access unrelated submission', async () => {
    const { service, req } = buildFlagServiceHarness({
      actorId: 42,
      assignment: { assigneeUserId: 7, assignmentType: 'individual' },
    });

    await expect(
      service.create(req, 125, { reason: 'Nope' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('shared assignee peer can list flags on the same submission', async () => {
    const flag = {
      id: 1,
      submissionId: 125,
      fieldId: 'temperature',
      reason: 'High',
      severity: 'high',
      isResolved: false,
      createdById: 7,
      createdAt: new Date(),
      resolvedById: null,
      resolvedAt: null,
      resolutionNote: null,
    } as unknown as DataCollectionSubmissionFlag;

    const { service, req, assignmentRepo } = buildFlagServiceHarness({
      actorId: 42,
      assignment: {
        assigneeUserId: 7,
        assignmentType: 'shared',
        sharedGroupKey: 'group-1',
      },
      flags: [flag],
    });

    // Peer lookup for shared group
    (assignmentRepo as any).findOne = jest
      .fn()
      .mockResolvedValueOnce({
        id: 5,
        assigneeUserId: 7,
        assignmentType: 'shared',
        sharedGroupKey: 'group-1',
      })
      .mockResolvedValueOnce({
        id: 8,
        assigneeUserId: 42,
        assignmentType: 'shared',
        sharedGroupKey: 'group-1',
      });

    const result = await service.findBySubmission(req, 125);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].submissionId).toBe(125);
  });

  it('employee cannot resolve flags', async () => {
    const flag = {
      id: 1,
      submissionId: 125,
      fieldId: null,
      reason: 'Issue',
      severity: 'medium',
      isResolved: false,
      createdById: 42,
      createdAt: new Date(),
      resolvedById: null,
      resolvedAt: null,
      resolutionNote: null,
    } as unknown as DataCollectionSubmissionFlag;

    const { service, req } = buildFlagServiceHarness({
      permissions: ['complete-dc-assignment'],
      flags: [flag],
    });

    await expect(
      service.resolve(req, 125, 1, { resolutionNote: 'done' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('manager can resolve a flag without auto-approving', async () => {
    const flag = {
      id: 1,
      submissionId: 125,
      fieldId: 'temperature',
      reason: 'High',
      severity: 'high',
      isResolved: false,
      createdById: 42,
      createdAt: new Date(),
      resolvedById: null,
      resolvedAt: null,
      resolutionNote: null,
    } as unknown as DataCollectionSubmissionFlag;

    const { service, req, savedEvents, submission } = buildFlagServiceHarness({
      permissions: ['review-dc-submission'],
      actorId: 99,
      submission: { status: 'flagged' },
      flags: [flag],
    });

    // findOne for flag with lock — return the mutable flag object
    req.tenantConnection.manager.getRepository(DataCollectionSubmissionFlag).findOne = jest
      .fn()
      .mockResolvedValue(flag);

    const result = await service.resolve(req, 125, 1, {
      resolutionNote: 'Confirmed with employee.',
    });

    expect(result.data.isResolved).toBe(true);
    expect(result.data.resolutionNote).toBe('Confirmed with employee.');
    expect(submission.status).toBe('flagged');
    expect(savedEvents.some((e) => e.action === 'flag_resolved')).toBe(true);
  });

  it('rejects resolving an already resolved flag', async () => {
    const flag = {
      id: 1,
      submissionId: 125,
      fieldId: null,
      reason: 'Issue',
      severity: 'medium',
      isResolved: true,
      createdById: 42,
      createdAt: new Date(),
      resolvedById: 99,
      resolvedAt: new Date(),
      resolutionNote: 'done',
    } as unknown as DataCollectionSubmissionFlag;

    const { service, req } = buildFlagServiceHarness({
      permissions: ['review-dc-submission'],
      actorId: 99,
      flags: [flag],
    });

    req.tenantConnection.manager.getRepository(DataCollectionSubmissionFlag).findOne = jest
      .fn()
      .mockResolvedValue(flag);

    await expect(service.resolve(req, 125, 1, {})).rejects.toThrow(BadRequestException);
  });

  it('employee cannot edit another user flag or a resolved flag', async () => {
    const otherFlag = {
      id: 2,
      submissionId: 125,
      fieldId: null,
      reason: 'Other',
      severity: 'low',
      isResolved: false,
      createdById: 7,
      createdAt: new Date(),
      resolvedById: null,
      resolvedAt: null,
      resolutionNote: null,
    } as unknown as DataCollectionSubmissionFlag;

    const resolvedFlag = {
      ...otherFlag,
      id: 3,
      createdById: 42,
      isResolved: true,
    } as unknown as DataCollectionSubmissionFlag;

    const harness = buildFlagServiceHarness({ flags: [otherFlag] });
    await expect(
      harness.service.update(harness.req, 125, 2, { reason: 'hack' }),
    ).rejects.toThrow(ForbiddenException);

    const harness2 = buildFlagServiceHarness({ flags: [resolvedFlag] });
    await expect(
      harness2.service.update(harness2.req, 125, 3, { reason: 'hack' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFound when submission missing', async () => {
    const { service, req, submissionRepo } = buildFlagServiceHarness();
    submissionRepo.findOne.mockResolvedValue(null as any);
    await expect(service.findBySubmission(req, 999)).rejects.toThrow(NotFoundException);
  });
});
