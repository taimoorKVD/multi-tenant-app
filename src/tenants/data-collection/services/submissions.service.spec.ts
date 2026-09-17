import { NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import {
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  TemplateVersion,
} from '../entities';
import { User } from '../../users/entities';

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

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any);
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
    const service = new SubmissionsService({ runAfterSubmit } as any);

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
    const service = new SubmissionsService({ runAfterSubmit } as any);

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
});
