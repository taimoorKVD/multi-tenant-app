import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { DataCollectionTemplate, TemplateVersion, TemplateStatus } from '../entities';

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TemplatesService({} as any);
  });

  function buildRepos() {
    const templateRepo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => ({ id: 1, ...e })),
      findOne: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const versionRepo = {
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => ({ id: 10, ...e })),
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

  describe('create', () => {
    it('creates template with ACTIVE status and schema', async () => {
      const req = createReq();
      req.templateRepo.save.mockResolvedValueOnce({ id: 1, name: 'Test', status: 'active' });

      const result = await service.create(req, { name: 'Test', schema: { sections: [] } });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Template created successfully');
      expect(req.templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test', status: TemplateStatus.ACTIVE }),
      );
      expect(req.versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 1, versionNumber: 1, schemaSnapshot: { sections: [] } }),
      );
      expect(req.versionRepo.save).toHaveBeenCalled();
    });

    it('creates template without version when no schema', async () => {
      const req = createReq();
      req.templateRepo.save.mockResolvedValueOnce({ id: 2, name: 'No Schema' });

      const result = await service.create(req, { name: 'No Schema' });

      expect(result.success).toBe(true);
      expect(req.versionRepo.save).not.toHaveBeenCalled();
    });

    it('uses createdBy from dto as actor', async () => {
      const req = createReq({ id: 5 });
      req.templateRepo.save.mockResolvedValueOnce({ id: 1 });

      await service.create(req, { name: 'X', createdBy: 99 });

      expect(req.templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 99 }),
      );
    });

    it('sets createdBy from req.user.id when dto has no createdBy', async () => {
      const req = createReq({ id: 7 });
      req.templateRepo.save.mockResolvedValueOnce({ id: 1 });

      await service.create(req, { name: 'X' });

      expect(req.templateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: 7 }),
      );
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
      expect(result.meta.page).toBe(1);
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

    it('calculates correct skip for page 3', async () => {
      const req = createReq();
      const qb = createQb([], 0);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(req, { page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });

    it('caps limit at 100', async () => {
      const req = createReq();
      const qb = createQb([], 0);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(req, { page: 1, limit: 200 });

      expect(qb.take).toHaveBeenCalledWith(100);
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
    it('updates template fields and creates new version', async () => {
      const req = createReq();
      const existing = { id: 1, name: 'Old', schema: null, isActive: true, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce({ ...existing, name: 'New' });
      req.versionRepo.findOne.mockResolvedValue({ versionNumber: 1 });

      const result = await service.update(req, 1, { name: 'New', schema: { sections: [] } });

      expect(result.success).toBe(true);
      expect(existing.name).toBe('New');
      expect(req.versionRepo.save).toHaveBeenCalled();
    });

    it('deactivates previous version when creating new one', async () => {
      const req = createReq();
      const existing = { id: 1, name: 'T', schema: null, isActive: true, updatedBy: null };
      const prevVersion = { versionNumber: 2, isActive: true };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce(existing);
      req.versionRepo.findOne.mockResolvedValue(prevVersion);

      await service.update(req, 1, { schema: { v: 2 } });

      expect(prevVersion.isActive).toBe(false);
      expect(req.versionRepo.save).toHaveBeenCalledWith(prevVersion);
    });

    it('creates version 1 when no previous version exists', async () => {
      const req = createReq();
      const existing = { id: 1, name: 'T', schema: null, isActive: true, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce(existing);
      req.versionRepo.findOne.mockResolvedValue(null);

      await service.update(req, 1, { schema: { v: 1 } });

      expect(req.versionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ versionNumber: 1 }),
      );
    });

    it('does not create version when no schema in dto', async () => {
      const req = createReq();
      const existing = { id: 1, name: 'T', schema: null, isActive: true, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(existing);
      req.templateRepo.save.mockResolvedValueOnce(existing);

      await service.update(req, 1, { name: 'Renamed' });

      expect(req.versionRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when template not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.update(req, 999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes template', async () => {
      const req = createReq();
      const template = { id: 1, name: 'ToDelete' };
      req.templateRepo.findOne.mockResolvedValue(template);

      const result = await service.remove(req, 1);

      expect(result.success).toBe(true);
      expect(req.templateRepo.softRemove).toHaveBeenCalledWith(template);
    });

    it('throws NotFoundException when not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('sets status to ACTIVE and isActive to true', async () => {
      const req = createReq();
      const template = { id: 1, status: 'draft', isActive: false, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);

      const result = await service.activate(req, 1);

      expect(result.success).toBe(true);
      expect(template.status).toBe(TemplateStatus.ACTIVE);
      expect(template.isActive).toBe(true);
    });

    it('throws NotFoundException when not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.activate(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('sets status to ARCHIVED', async () => {
      const req = createReq();
      const template = { id: 1, status: 'active', updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);

      const result = await service.archive(req, 1);

      expect(result.success).toBe(true);
      expect(template.status).toBe(TemplateStatus.ARCHIVED);
    });

    it('throws NotFoundException when not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.archive(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('returns empty when no filters provided', async () => {
      const req = createReq();

      const result = await service.search(req);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('searches by name with ILIKE', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1, name: 'Manager Report' }]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.search(req, undefined, { name: 'manager' });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'template.name ILIKE :name',
        { name: '%manager%' },
      );
    });

    it('searches by status', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1, status: 'active' }]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.search(req, undefined, { status: 'active' });

      expect(result.success).toBe(true);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'template.status = :status',
        { status: 'active' },
      );
    });

    it('searches by name and status together', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1 }]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search(req, undefined, { name: 'report', status: 'draft' });

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('uses default limit of 15 when not specified', async () => {
      const req = createReq();
      const qb = createQb([]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search(req, undefined, { name: 'test' });

      expect(qb.take).toHaveBeenCalledWith(15);
    });

    it('caps limit at 50', async () => {
      const req = createReq();
      const qb = createQb([]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search(req, 100, { name: 'test' });

      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('ignores unknown filter keys in query builder', async () => {
      const req = createReq();
      const qb = createQb([{ id: 1 }]);
      req.templateRepo.createQueryBuilder.mockReturnValue(qb);

      await service.search(req, undefined, { unknown: 'value' });

      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(qb.getMany).toHaveBeenCalled();
    });

    it('returns empty when limit filter key is present', async () => {
      const req = createReq();

      const result = await service.search(req, undefined, { limit: '10' });

      expect(result.count).toBe(0);
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

    it('wraps unexpected errors as InternalServerErrorException in search', async () => {
      const req = createReq();
      req.templateRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.search(req, undefined, { name: 'x' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('wraps unexpected errors as InternalServerErrorException in create', async () => {
      const req = createReq();
      req.templateRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.create(req, { name: 'X' })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
