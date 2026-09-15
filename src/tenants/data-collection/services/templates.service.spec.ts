import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { DataCollectionTemplate, TemplateVersion, TemplateStatus } from '../entities';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let assignmentsService: {
    materializeFromTemplate: jest.Mock;
    cancelFutureForTemplate: jest.Mock;
    cancelOpenAssignmentsForTemplate: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    assignmentsService = {
      materializeFromTemplate: jest.fn().mockResolvedValue([{ id: 1 }]),
      cancelFutureForTemplate: jest.fn().mockResolvedValue(undefined),
      cancelOpenAssignmentsForTemplate: jest.fn().mockResolvedValue(undefined),
    };
    const workflowActions = {
      notifyAssigneesOnPublish: jest.fn().mockResolvedValue({ sent: 0, failed: 0, skipped: 0 }),
    };
    service = new TemplatesService(assignmentsService as any, workflowActions as any);
  });

  function buildRepos() {
    const templateRepo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => ({ id: 1, ...e })),
      findOne: jest.fn(),
      findBy: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const versionRepo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => ({ id: 10, versionNumber: e.versionNumber ?? 1, ...e })),
      findOne: jest.fn(),
    };

    const getRepository = jest.fn().mockImplementation((entity: any) => {
      if (entity === DataCollectionTemplate) return templateRepo;
      if (entity === TemplateVersion) return versionRepo;
      throw new Error(`Unexpected repo: ${entity?.name}`);
    });

    return { templateRepo, versionRepo, getRepository };
  }

  function createReq(user?: any) {
    const repos = buildRepos();
    return {
      tenantConnection: { getRepository: repos.getRepository },
      user: user ?? { id: 1 },
      ...repos,
    } as any;
  }

  function createQb(data: any[] = [], total = 0) {
    const qb = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
      getMany: jest.fn().mockResolvedValue(data),
    };
    return qb;
  }

  const fullSchema = {
    assign: { users: [1], jobPosition: [2] },
    report: { users: [3], jobPosition: [1] },
    frequency: {
      type: 'atOnce',
      date: '2026-08-21',
      jobPosition: null,
      recurring: null,
    },
    sections: [],
  };

  describe('create', () => {
    it('always publishes on create when schema is complete', async () => {
      const req = createReq();
      const draft = { id: 1, name: 'Test', schema: fullSchema, status: TemplateStatus.DRAFT };
      req.templateRepo.save
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.create(req, { name: 'Test', schema: fullSchema as any });

      expect(result.success).toBe(true);
      expect(result.message).toContain('published');
      expect(result.data.status).toBe(TemplateStatus.ACTIVE);
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
      expect(req.versionRepo.save).toHaveBeenCalled();
    });

    it('still publishes even when publish=false is sent', async () => {
      const req = createReq();
      const draft = { id: 1, name: 'Test', schema: fullSchema, status: TemplateStatus.DRAFT };
      req.templateRepo.save
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.create(req, {
        name: 'Test',
        schema: fullSchema as any,
        publish: false,
      });

      expect(result.message).toContain('published');
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });

    it('uses createdBy from dto as actor', async () => {
      const req = createReq({ id: 5 });
      const draft = { id: 1, name: 'X', schema: fullSchema, status: TemplateStatus.DRAFT };
      req.templateRepo.save
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      await service.create(req, { name: 'X', schema: fullSchema as any, createdBy: 99 });

      expect(req.templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 99 }),
      );
    });

    it('rejects create before save when atOnce has no date', async () => {
      const req = createReq();
      const schema = {
        assign: { users: [1], jobPosition: [] },
        frequency: { type: 'atOnce', date: null, recurring: null },
        sections: [],
      };

      await expect(service.create(req, { name: 'No Date', schema: schema as any })).rejects.toThrow(
        BadRequestException,
      );
      expect(req.templateRepo.save).not.toHaveBeenCalled();
    });

    it('creates and publishes recurring without date', async () => {
      const req = createReq();
      const schema = {
        assign: { users: [1], jobPosition: [] },
        report: { users: [], jobPosition: [] },
        frequency: {
          type: 'recurring',
          date: null,
          recurring: { interval: 1, unit: 'month', repeat: 2 },
        },
        sections: [],
      };
      const draft = { id: 1, name: 'Recurring', schema, status: TemplateStatus.DRAFT };
      req.templateRepo.save
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce({ ...draft, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.create(req, { name: 'Recurring', schema: schema as any });

      expect(result.success).toBe(true);
      expect(result.message).toContain('published');
      expect(schema.frequency.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('findAll', () => {
    it('returns paginated templates', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1 }, { id: 2 }], 2);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(req, { page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('defaults page=1, limit=15', async () => {
      const req = createReq();
      const qb = createQb([], 0);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(req, {});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(15);
    });
  });

  describe('findOne', () => {
    it('returns template by id', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1, name: 'Test' });

      const result = await service.findOne(req, 1);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });

    it('throws NotFoundException when not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates draft schema without creating a version', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'Old',
        schema: null,
        status: TemplateStatus.DRAFT,
        isActive: true,
        updatedBy: null,
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce({ ...existing, name: 'New' });

      const result = await service.update(req, 1, { name: 'New', schema: { sections: [] } as any });

      expect(result.success).toBe(true);
      expect(existing.name).toBe('New');
      expect(req.versionRepo.save).not.toHaveBeenCalled();
    });

    it('moves ACTIVE template to DRAFT when non-schedule schema changes without publish', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'T',
        schema: fullSchema,
        status: TemplateStatus.ACTIVE,
        isActive: true,
        updatedBy: null,
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce(existing);

      await service.update(req, 1, { schema: { ...fullSchema, sections: [] } as any });

      expect(existing.status).toBe(TemplateStatus.DRAFT);
      expect(assignmentsService.materializeFromTemplate).not.toHaveBeenCalled();
    });

    it('auto-publishes when frequency changes (even without publish flag)', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'T',
        schema: fullSchema,
        status: TemplateStatus.ACTIVE,
        isActive: true,
        updatedBy: null,
      };
      const nextSchema = {
        ...fullSchema,
        frequency: {
          type: 'recurring',
          date: '2026-09-02',
          jobPosition: null,
          recurring: {
            every: 3,
            interval: 'week',
            repeatCount: 2,
            daysOfWeek: ['tuesday', 'sunday'],
          },
        },
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save
        .mockResolvedValueOnce({ ...existing, schema: nextSchema })
        .mockResolvedValueOnce({ ...existing, schema: nextSchema, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.update(req, 1, { schema: nextSchema as any });

      expect(result.success).toBe(true);
      expect(result.message).toContain('published');
      expect(assignmentsService.cancelFutureForTemplate).toHaveBeenCalled();
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });

    it('auto-publishes when assign targets change', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'T',
        schema: fullSchema,
        status: TemplateStatus.ACTIVE,
        isActive: true,
        updatedBy: null,
      };
      const nextSchema = {
        ...fullSchema,
        assign: { users: [1, 2], jobPosition: [] },
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save
        .mockResolvedValueOnce({ ...existing, schema: nextSchema })
        .mockResolvedValueOnce({ ...existing, schema: nextSchema, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.update(req, 1, { schema: nextSchema as any });

      expect(result.message).toContain('published');
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });

    it('does not auto-publish frequency change when publish=false', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'T',
        schema: fullSchema,
        status: TemplateStatus.ACTIVE,
        isActive: true,
        updatedBy: null,
      };
      const nextSchema = {
        ...fullSchema,
        frequency: {
          ...fullSchema.frequency,
          type: 'recurring',
          recurring: { every: 1, interval: 'day', repeatCount: 3 },
        },
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce(existing);

      const result = await service.update(req, 1, {
        schema: nextSchema as any,
        publish: false,
      });

      expect(result.message).toBe('Template updated successfully');
      expect(existing.status).toBe(TemplateStatus.DRAFT);
      expect(assignmentsService.materializeFromTemplate).not.toHaveBeenCalled();
    });

    it('publishes when publish=true', async () => {
      const req = createReq();
      const existing = {
        id: 1,
        name: 'T',
        schema: fullSchema,
        status: TemplateStatus.DRAFT,
        isActive: true,
        updatedBy: null,
      };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({ ...existing, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.update(req, 1, { publish: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('published');
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });

    it('throws NotFoundException when template not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.update(req, 999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('publish', () => {
    it('rejects templates without assign targets', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({
        id: 1,
        schema: { frequency: { type: 'atOnce', date: '2026-01-01', recurring: null }, sections: [] },
        status: TemplateStatus.DRAFT,
      });

      await expect(service.publish(req, 1)).rejects.toThrow(BadRequestException);
    });

    it('publishes recurring without date by defaulting to today', async () => {
      const req = createReq();
      const schema = {
        assign: { users: [1], jobPosition: [] },
        report: { users: [], jobPosition: [] },
        frequency: {
          type: 'recurring',
          date: null,
          jobPosition: null,
          recurring: { interval: 1, unit: 'month', repeat: 1, monthlyRule: { type: 'dayOfMonth', day: 1 } },
        },
        sections: [],
      };
      const template = { id: 1, name: 'Recurring', schema, status: TemplateStatus.DRAFT };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.templateRepo.save.mockResolvedValue({ ...template, status: TemplateStatus.ACTIVE });
      req.versionRepo.findOne.mockResolvedValue(null);

      const result = await service.publish(req, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('published');
      expect(schema.frequency.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });
  });

  describe('activate', () => {
    it('activates when an active version exists', async () => {
      const req = createReq();
      const template = { id: 1, status: 'draft', isActive: false, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue({ id: 10, isActive: true });

      const result = await service.activate(req, 1);

      expect(result.success).toBe(true);
      expect(template.status).toBe(TemplateStatus.ACTIVE);
      expect(template.isActive).toBe(true);
    });

    it('rejects activate when no published version', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1, status: 'draft' });
      req.versionRepo.findOne.mockResolvedValue(null);

      await expect(service.activate(req, 1)).rejects.toThrow(BadRequestException);
    });

    it('rejects activate for archived templates', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1, status: TemplateStatus.ARCHIVED });

      await expect(service.activate(req, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('archive', () => {
    it('sets status to ARCHIVED, deactivates, and cancels open assignments', async () => {
      const req = createReq();
      const template = { id: 1, status: 'active', isActive: true, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.templateRepo.save.mockResolvedValue({
        ...template,
        status: TemplateStatus.ARCHIVED,
        isActive: false,
      });

      const result = await service.archive(req, 1);

      expect(result.success).toBe(true);
      expect(template.status).toBe(TemplateStatus.ARCHIVED);
      expect(template.isActive).toBe(false);
      expect(assignmentsService.cancelOpenAssignmentsForTemplate).toHaveBeenCalledWith(req, 1);
    });
  });

  describe('remove', () => {
    it('archives instead of soft-deleting and cancels open assignments', async () => {
      const req = createReq();
      const template = { id: 1, status: TemplateStatus.ACTIVE, isActive: true, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.templateRepo.save.mockResolvedValue({
        ...template,
        status: TemplateStatus.ARCHIVED,
        isActive: false,
      });

      const result = await service.remove(req, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('archive');
      expect(req.templateRepo.softRemove).not.toHaveBeenCalled();
      expect(template.status).toBe(TemplateStatus.ARCHIVED);
      expect(template.isActive).toBe(false);
      expect(assignmentsService.cancelOpenAssignmentsForTemplate).toHaveBeenCalledWith(req, 1);
    });
  });

  describe('bulkRemove', () => {
    it('archives all templates and cancels open assignments', async () => {
      const req = createReq();
      const templates = [
        { id: 1, status: TemplateStatus.ACTIVE, isActive: true },
        { id: 2, status: TemplateStatus.DRAFT, isActive: true },
      ];
      req.templateRepo.findBy.mockResolvedValue(templates);
      req.templateRepo.save.mockImplementation(async (e: any) => e);

      const result = await service.bulkRemove(req, [1, 2]);

      expect(result.success).toBe(true);
      expect(result.data.deletedIds).toEqual([1, 2]);
      expect(req.templateRepo.softRemove).not.toHaveBeenCalled();
      expect(assignmentsService.cancelOpenAssignmentsForTemplate).toHaveBeenCalledTimes(2);
      expect(templates.every((t) => t.status === TemplateStatus.ARCHIVED)).toBe(true);
      expect(templates.every((t) => t.isActive === false)).toBe(true);
    });
  });

  describe('restore', () => {
    it('restores archived template with published version and rematerializes', async () => {
      const req = createReq();
      const template = {
        id: 1,
        name: 'Form',
        schema: fullSchema,
        status: TemplateStatus.ARCHIVED,
        isActive: false,
      };
      const version = { id: 10, templateId: 1, isActive: true, schemaSnapshot: fullSchema };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue(version);
      req.templateRepo.save.mockResolvedValue({
        ...template,
        status: TemplateStatus.ACTIVE,
        isActive: true,
      });

      const result = await service.restore(req, 1);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(TemplateStatus.ACTIVE);
      expect(assignmentsService.materializeFromTemplate).toHaveBeenCalled();
    });

    it('restores as draft when no published version exists', async () => {
      const req = createReq();
      const template = { id: 1, status: TemplateStatus.ARCHIVED, isActive: false };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue(null);
      req.templateRepo.save.mockResolvedValue({
        ...template,
        status: TemplateStatus.DRAFT,
        isActive: true,
      });

      const result = await service.restore(req, 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('draft');
      expect(assignmentsService.materializeFromTemplate).not.toHaveBeenCalled();
    });

    it('rejects restore when template is not archived', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1, status: TemplateStatus.ACTIVE });

      await expect(service.restore(req, 1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('search', () => {
    it('returns empty when no filters provided', async () => {
      const req = createReq();
      const result = await service.search(req);
      expect(result.count).toBe(0);
    });

    it('searches by name with ILIKE', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1, name: 'Manager Report' }]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.search(req, undefined, { name: 'manager' });

      expect(result.count).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith('template.name ILIKE :name', { name: '%manager%' });
    });
  });

  describe('error handling', () => {
    it('wraps unexpected errors as InternalServerErrorException in findAll', async () => {
      const req = createReq();
      req.templateRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.findAll(req, {})).rejects.toThrow(InternalServerErrorException);
    });

    it('wraps unexpected errors as InternalServerErrorException in create', async () => {
      const req = createReq();
      req.templateRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(req, { name: 'X', schema: fullSchema as any })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
