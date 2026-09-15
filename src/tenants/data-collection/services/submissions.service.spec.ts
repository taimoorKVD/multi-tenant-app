import { NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import {
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionTemplate,
  TemplateVersion,
} from '../entities';

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

    const req = {
      user: { id: 1 },
      tenantConnection: {
        getRepository: (entity: any) => {
          if (entity === DataCollectionSubmission) return submissionRepo;
          if (entity === DataCollectionAssignment) return assignmentRepo;
          if (entity === DataCollectionTemplate) return templateRepo;
          if (entity === TemplateVersion) return versionRepo;
          return {};
        },
      },
    };

    const service = new SubmissionsService({ runAfterSubmit: jest.fn() } as any);
    return { service, req, submissionRepo, assignmentRepo, templateRepo, versionRepo };
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
      template: {
        id: 1,
        name: 'Manager Report',
        status: 'active',
        isActive: true,
        schema: version.schemaSnapshot,
      },
    });
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
  });

  it('findOne throws NotFoundException when missing', async () => {
    const { service, req, submissionRepo } = buildService();
    submissionRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne(req, 999)).rejects.toThrow(NotFoundException);
  });
});
