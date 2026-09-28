import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { FrequencyService } from './frequency.service';
import {
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionSubmissionFlag,
  DataCollectionSubmissionReviewEvent,
  DataCollectionTemplate,
  TemplateVersion,
} from '../entities';
import { User } from '../../users/entities';

const frequencyService = new FrequencyService();

function withFlagAndEventSupport(req: any) {
  const flagRepo = {
    count: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
  };
  const eventRepo = {
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
  };
  const originalGetRepo = req.tenantConnection.getRepository;
  req.tenantConnection.getRepository = (entity: any) => {
    if (entity === DataCollectionSubmissionFlag) return flagRepo;
    if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
    return originalGetRepo(entity);
  };
  req.tenantConnection.manager = {
    getRepository: (entity: any) => {
      if (entity === DataCollectionSubmissionFlag) return flagRepo;
      if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
      return originalGetRepo(entity);
    },
    transaction: jest.fn(async (cb: Function) =>
      cb({
        getRepository: (entity: any) => {
          if (entity === DataCollectionSubmissionFlag) return flagRepo;
          if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
          return originalGetRepo(entity);
        },
      }),
    ),
  };
  return { flagRepo, eventRepo };
}

describe('SubmissionsService findAll / findOne template enrichment', () => {
  const template = {
    id: 1,
    name: 'Manager Report',
    schema: {
      formName: 'Manager Report',
      assign: { users: [4, 2], jobPosition: null },
      report: { users: [3], jobPosition: null },
      sections: [{ id: 'sec_001', name: 'Response Form' }],
    },
    status: 'active',
    isActive: true,
    createdBy: 1,
    updatedBy: 1,
    createdAt: new Date('2026-08-12T01:41:18.835Z'),
    updatedAt: new Date('2026-09-15T02:44:50.121Z'),
    deletedAt: null,
  } as unknown as DataCollectionTemplate;

  const version = {
    id: 6,
    templateId: 1,
    schemaSnapshot: {
      formName: 'Manager Report',
      sections: [{ id: 'sec_001', name: 'Pinned Response Form' }],
    },
  } as unknown as TemplateVersion;

  const submission = {
    id: 10,
    assignmentId: 5,
    templateVersionId: 6,
    submittedBy: 4,
    answers: { fld_001: 'hello' },
    status: 'submitted',
    submittedAt: new Date('2026-09-15T02:11:30.548Z'),
    createdBy: 4,
    updatedBy: 4,
    createdAt: new Date('2026-09-15T02:11:30.548Z'),
    updatedAt: new Date('2026-09-15T02:11:30.548Z'),
    deletedAt: null,
  } as unknown as DataCollectionSubmission;

  const assignment = {
    id: 5,
    templateId: 1,
    status: 'completed',
    assignmentType: 'shared',
    completedByUserId: 7,
    completedAt: new Date('2026-09-17T14:16:57.919Z'),
  } as unknown as DataCollectionAssignment;

  function buildService() {
    const submissionRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
    };
    const assignmentRepo = {
      find: jest.fn().mockResolvedValue([assignment]),
    };
    const templateRepo = {
      find: jest.fn().mockResolvedValue([template]),
      findOne: jest.fn(),
    };
    const versionRepo = {
      find: jest.fn().mockResolvedValue([version]),
      findOne: jest.fn(),
    };
    const userRepo = {
      find: jest.fn().mockResolvedValue([{ id: 7, name: 'Cyrus Mccarty' }]),
    };

    const req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    withFlagAndEventSupport(req);

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any, frequencyService);
    return { service, req, submissionRepo, assignmentRepo, templateRepo, versionRepo, userRepo };
  }

  it('findAll includes full template with pinned version schema', async () => {
    const { service, req, submissionRepo } = buildService();
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[submission], 1]),
    };
    submissionRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll(req, { page: 1, limit: 15 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 10,
      assignmentId: 5,
      templateId: 1,
      templateName: 'Manager Report',
      formName: 'Manager Report',
      answers: { fld_001: 'hello' },
      mode: 'shared',
      completion: {
        state: 'completed_by_other',
        title: 'Completed by another user',
        completedByUserId: 7,
        completedByName: 'Cyrus Mccarty',
        completedAt: assignment.completedAt,
      },
      template: {
        id: 1,
        name: 'Manager Report',
        status: 'active',
        isActive: true,
        schema: version.schemaSnapshot,
      },
    });
    expect(result.data[0].completion?.message).toContain('Cyrus Mccarty');
  });

  it('findOne includes full template payload', async () => {
    const { service, req, submissionRepo } = buildService();
    submissionRepo.findOne.mockResolvedValue(submission);

    const result = await service.findOne(req, 10);

    expect(result.success).toBe(true);
    expect(result.data.template).toEqual(
      expect.objectContaining({
        id: 1,
        name: 'Manager Report',
        schema: version.schemaSnapshot,
      }),
    );
    expect(result.data.templateId).toBe(1);
    expect(result.data.mode).toBe('shared');
    expect(result.data.completion).toMatchObject({
      state: 'completed_by_other',
      completedByUserId: 7,
      completedByName: 'Cyrus Mccarty',
    });
  });

  it('findOne throws NotFoundException when missing', async () => {
    const { service, req, submissionRepo } = buildService();
    submissionRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(req, 999)).rejects.toThrow(NotFoundException);
  });
});

describe('SubmissionsService assign.mode shared completion', () => {
  it('marks shared siblings completed when one assignee submits', async () => {
    const runAfterSubmit = jest.fn().mockResolvedValue({ actions: [] });
    const service = new SubmissionsService({ runAfterSubmit } as any, frequencyService);

    const assignment = {
      id: 5,
      templateId: 1,
      templateVersionId: 6,
      status: 'pending',
      assignmentType: 'shared',
      sharedGroupKey: '1:6:2026-09-15T00:00:00.000Z:shared',
    };

    const updateExecute = jest.fn().mockResolvedValue({ affected: 2 });
    const assignmentRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(assignment) // load assignment
        .mockResolvedValueOnce(null), // assertSharedGroupOpen — no sibling completed
      find: jest.fn().mockResolvedValue([
        {
          id: 5,
          templateId: 1,
          status: 'completed',
          assignmentType: 'shared',
          completedByUserId: 11,
          completedAt: new Date('2026-09-15T02:11:30.548Z'),
        },
      ]),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: updateExecute,
      })),
      save: jest.fn(),
    };
    const submissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 77, ...row })),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 6,
        templateId: 1,
        schemaSnapshot: { sections: [] },
      }),
      find: jest.fn().mockResolvedValue([
        { id: 6, templateId: 1, schemaSnapshot: { sections: [] } },
      ]),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Shared Form',
        schema: {},
        status: 'active',
        isActive: true,
        deletedAt: null,
      }),
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Shared Form',
          schema: {},
          status: 'active',
          isActive: true,
          deletedAt: null,
        },
      ]),
    };
    const userRepo = {
      find: jest.fn().mockResolvedValue([{ id: 11, name: 'Submitter' }]),
    };

    const req = {
      user: { id: 11 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    withFlagAndEventSupport(req);

    const result = await service.create(req, 5, { answers: {}, submit: true } as any);

    expect(result.success).toBe(true);
    expect(updateExecute).toHaveBeenCalled();
    expect(assignmentRepo.save).not.toHaveBeenCalled();
    expect(runAfterSubmit).toHaveBeenCalled();
    expect(result.data.mode).toBe('shared');
    expect(result.data.completion).toMatchObject({
      state: 'completed_by_me',
      completedByUserId: 11,
      completedByName: 'Submitter',
    });
  });

  it('completes only the current assignment when assign.mode is individual', async () => {
    const runAfterSubmit = jest.fn().mockResolvedValue({ actions: [] });
    const service = new SubmissionsService({ runAfterSubmit } as any, frequencyService);

    const assignment = {
      id: 5,
      templateId: 1,
      templateVersionId: 6,
      status: 'pending',
      assignmentType: 'individual',
      sharedGroupKey: null,
    };

    const assignmentRepo = {
      findOne: jest.fn().mockResolvedValue(assignment),
      find: jest.fn().mockResolvedValue([
        {
          id: 5,
          templateId: 1,
          status: 'completed',
          assignmentType: 'individual',
          completedByUserId: 11,
          completedAt: new Date('2026-09-15T02:11:30.548Z'),
        },
      ]),
      createQueryBuilder: jest.fn(),
      save: jest.fn(async (row) => row),
    };
    const submissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({ id: 77, ...row })),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 6,
        templateId: 1,
        schemaSnapshot: { sections: [] },
      }),
      find: jest.fn().mockResolvedValue([
        { id: 6, templateId: 1, schemaSnapshot: { sections: [] } },
      ]),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Individual Form',
        schema: {},
        status: 'active',
        isActive: true,
        deletedAt: null,
      }),
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Individual Form',
          schema: {},
          status: 'active',
          isActive: true,
          deletedAt: null,
        },
      ]),
    };
    const userRepo = {
      find: jest.fn().mockResolvedValue([{ id: 11, name: 'Submitter' }]),
    };

    const req = {
      user: { id: 11 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    withFlagAndEventSupport(req);

    const result = await service.create(req, 5, { answers: {}, submit: true } as any);

    expect(assignmentRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        completedByUserId: 11,
      }),
    );
    expect(result.data.mode).toBe('individual');
    expect(result.data.completion).toMatchObject({
      state: 'completed',
      completedByUserId: 11,
    });
  });

  it('upserts draft answers so resume keeps previously inputted data', async () => {
    const existingDraft = {
      id: 40,
      assignmentId: 5,
      templateVersionId: 6,
      answers: { fld_001: 'old' },
      status: 'draft',
      submittedAt: null,
      submittedBy: 4,
      updatedBy: 4,
    };
    const assignmentRow = {
      id: 5,
      templateId: 1,
      templateVersionId: 6,
      status: 'pending',
      assignmentType: 'individual',
      sharedGroupKey: null,
    };
    const assignmentRepo = {
      findOne: jest.fn().mockResolvedValue(assignmentRow),
      save: jest.fn(async (row) => row),
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([
        {
          id: 5,
          templateId: 1,
          status: 'in_progress',
          assignmentType: 'individual',
          completedByUserId: null,
          completedAt: null,
        },
      ]),
    };
    const submissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([existingDraft]),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 6,
        templateId: 1,
        schemaSnapshot: { sections: [] },
      }),
      find: jest.fn().mockResolvedValue([
        { id: 6, templateId: 1, schemaSnapshot: { sections: [] } },
      ]),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Form',
        schema: {},
        status: 'active',
        isActive: true,
        deletedAt: null,
      }),
      find: jest.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Form',
          schema: {},
          status: 'active',
          isActive: true,
          deletedAt: null,
        },
      ]),
    };
    const userRepo = { find: jest.fn().mockResolvedValue([]) };

    const req = {
      user: { id: 4 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    withFlagAndEventSupport(req);

    const service = new SubmissionsService(
      {
        runAfterSubmit: jest.fn(),
      } as any,
      new FrequencyService(),
    );

    const result = await service.create(req, 5, {
      answers: { fld_001: 'kept on leave' },
      submit: false,
    } as any);

    expect(submissionRepo.create).not.toHaveBeenCalled();
    expect(submissionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 40,
        answers: { fld_001: 'kept on leave' },
        status: 'draft',
      }),
    );
    expect(assignmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'in_progress' }),
    );
    expect(result.message).toContain('Draft');
    expect(result.data.answers).toEqual({ fld_001: 'kept on leave' });
  });
});

describe('SubmissionsService review workflow', () => {
  function buildReviewHarness(options?: {
    status?: string;
    permissions?: string[];
    unresolvedFlags?: number;
  }) {
    const submission = {
      id: 10,
      assignmentId: 5,
      templateVersionId: 6,
      submittedBy: 4,
      answers: { fld_001: 'hello' },
      status: options?.status ?? 'submitted',
      submittedAt: new Date('2026-09-15T02:11:30.548Z'),
      reviewedById: null,
      reviewedAt: null,
      reviewNote: null,
      createdBy: 4,
      updatedBy: 4,
      createdAt: new Date('2026-09-15T02:11:30.548Z'),
      updatedAt: new Date('2026-09-15T02:11:30.548Z'),
      deletedAt: null,
    };

    const assignment = {
      id: 5,
      templateId: 1,
      status: 'completed',
      assignmentType: 'individual',
      completedByUserId: 4,
      completedAt: new Date('2026-09-15T02:11:30.548Z'),
    };

    const template = {
      id: 1,
      name: 'Form',
      schema: {},
      status: 'active',
      isActive: true,
      deletedAt: null,
    };

    const version = { id: 6, templateId: 1, schemaSnapshot: { sections: [] } };

    const submissionRepo = {
      findOne: jest.fn(async () => ({ ...submission })),
      save: jest.fn(async (row) => row),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((row) => row),
    };
    const assignmentRepo = {
      findOne: jest.fn().mockResolvedValue(assignment),
      find: jest.fn().mockResolvedValue([assignment]),
      save: jest.fn(async (row) => row),
      createQueryBuilder: jest.fn(),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue(template),
      find: jest.fn().mockResolvedValue([template]),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue(version),
      find: jest.fn().mockResolvedValue([version]),
    };
    const userRepo = { find: jest.fn().mockResolvedValue([{ id: 4, name: 'Emp' }]) };
    const flagRepo = {
      count: jest.fn().mockResolvedValue(options?.unresolvedFlags ?? 0),
    };
    const eventRepo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };

    const managerRepos = {
      getRepository: (entity: any) => {
        if (entity === DataCollectionSubmission) return submissionRepo;
        if (entity === DataCollectionSubmissionFlag) return flagRepo;
        if (entity === DataCollectionSubmissionReviewEvent) return eventRepo;
        if (entity === DataCollectionAssignment) return assignmentRepo;
        if (entity === TemplateVersion) return versionRepo;
        if (entity === DataCollectionTemplate) return templateRepo;
        if (entity === User) return userRepo;
        return {};
      },
    };

    const req = {
      user: {
        id: 99,
        permissions: options?.permissions ?? ['review-dc-submission'],
      },
      tenantConnection: {
        getRepository: managerRepos.getRepository,
        manager: {
          ...managerRepos,
          transaction: jest.fn(async (cb: Function) => cb(managerRepos)),
        },
      },
    };

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any, frequencyService);
    return { service, req, submissionRepo, flagRepo, eventRepo, submission };
  }

  it('draft without flags finalizes as submitted', async () => {
    const existingDraft = {
      id: 40,
      assignmentId: 5,
      templateVersionId: 6,
      answers: {},
      status: 'draft',
      submittedAt: null,
      submittedBy: 4,
      updatedBy: 4,
    };
    const assignmentRow = {
      id: 5,
      templateId: 1,
      templateVersionId: 6,
      status: 'pending',
      assignmentType: 'individual',
      sharedGroupKey: null,
    };
    const assignmentRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(assignmentRow)
        .mockResolvedValueOnce(null),
      save: jest.fn(async (row) => row),
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([
        {
          ...assignmentRow,
          status: 'completed',
          completedByUserId: 4,
          completedAt: new Date(),
        },
      ]),
    };
    const submissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([existingDraft]),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 6, templateId: 1, schemaSnapshot: { sections: [] } }),
      find: jest.fn().mockResolvedValue([{ id: 6, templateId: 1, schemaSnapshot: { sections: [] } }]),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Form',
        schema: {},
        status: 'active',
        isActive: true,
        deletedAt: null,
      }),
      find: jest.fn().mockResolvedValue([
        { id: 1, name: 'Form', schema: {}, status: 'active', isActive: true, deletedAt: null },
      ]),
    };
    const userRepo = { find: jest.fn().mockResolvedValue([{ id: 4, name: 'Emp' }]) };
    const req = {
      user: { id: 4 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    const { flagRepo } = withFlagAndEventSupport(req);
    flagRepo.count.mockResolvedValue(0);

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any, frequencyService);
    const result = await service.create(req, 5, { submit: true } as any);
    expect(result.data.status).toBe('submitted');
  });

  it('draft with unresolved flags finalizes as flagged', async () => {
    const existingDraft = {
      id: 40,
      assignmentId: 5,
      templateVersionId: 6,
      answers: {},
      status: 'draft',
      submittedAt: null,
      submittedBy: 4,
      updatedBy: 4,
    };
    const assignmentRow = {
      id: 5,
      templateId: 1,
      templateVersionId: 6,
      status: 'pending',
      assignmentType: 'individual',
      sharedGroupKey: null,
    };
    const assignmentRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(assignmentRow)
        .mockResolvedValueOnce(null),
      save: jest.fn(async (row) => row),
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([
        {
          ...assignmentRow,
          status: 'completed',
          completedByUserId: 4,
          completedAt: new Date(),
        },
      ]),
    };
    const submissionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([existingDraft]),
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 6, templateId: 1, schemaSnapshot: { sections: [] } }),
      find: jest.fn().mockResolvedValue([{ id: 6, templateId: 1, schemaSnapshot: { sections: [] } }]),
    };
    const templateRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Form',
        schema: {},
        status: 'active',
        isActive: true,
        deletedAt: null,
      }),
      find: jest.fn().mockResolvedValue([
        { id: 1, name: 'Form', schema: {}, status: 'active', isActive: true, deletedAt: null },
      ]),
    };
    const userRepo = { find: jest.fn().mockResolvedValue([{ id: 4, name: 'Emp' }]) };
    const req = {
      user: { id: 4 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === TemplateVersion) return versionRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === User) return userRepo;
          return {};
        },
      },
    };
    const { flagRepo } = withFlagAndEventSupport(req);
    flagRepo.count.mockResolvedValue(2);

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any, frequencyService);
    const result = await service.create(req, 5, { submit: true } as any);
    expect(result.data.status).toBe('flagged');
  });

  it('rejects approval when unresolved flags exist', async () => {
    const { service, req } = buildReviewHarness({
      status: 'flagged',
      unresolvedFlags: 1,
    });
    await expect(service.approve(req, 10)).rejects.toThrow(
      /Cannot approve a submission with unresolved flags/,
    );
  });

  it('approves when all flags are resolved and stores review metadata', async () => {
    const { service, req, eventRepo } = buildReviewHarness({
      status: 'flagged',
      unresolvedFlags: 0,
    });
    const result = await service.approve(req, 10);
    expect(result.data.status).toBe('approved');
    expect(result.data.reviewedBy).toBe(99);
    expect(result.data.reviewedAt).toBeTruthy();
    expect(eventRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'approved' }),
    );
  });

  it('fails submission with review note and keeps flags', async () => {
    const { service, req, flagRepo } = buildReviewHarness({
      status: 'submitted',
      unresolvedFlags: 2,
    });
    const result = await service.fail(req, 10, {
      note: 'Temperature was outside the acceptable range.',
    });
    expect(result.data.status).toBe('failed');
    expect(result.data.reviewNote).toBe(
      'Temperature was outside the acceptable range.',
    );
    expect(result.data.reviewedBy).toBe(99);
    // fail must not delete/clear flags
    expect(flagRepo.count).not.toHaveBeenCalled();
  });

  it('employee without review permission cannot approve or fail', async () => {
    const approveHarness = buildReviewHarness({
      permissions: ['complete-dc-assignment'],
    });
    await expect(approveHarness.service.approve(approveHarness.req, 10)).rejects.toThrow(
      ForbiddenException,
    );

    const failHarness = buildReviewHarness({
      permissions: ['complete-dc-assignment'],
    });
    await expect(
      failHarness.service.fail(failHarness.req, 10, { note: 'nope' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects invalid transitions such as draft → approved', async () => {
    const { service, req } = buildReviewHarness({ status: 'draft' });
    await expect(service.approve(req, 10)).rejects.toThrow(BadRequestException);
  });
});
