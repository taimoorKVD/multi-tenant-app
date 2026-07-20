import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { TemplateVersionsService } from './template-versions.service';
import { DataCollectionTemplate, TemplateVersion, TemplateStatus } from '../entities';

describe('TemplateVersionsService', () => {
  let service: TemplateVersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TemplateVersionsService();
  });

  function buildRepos() {
    const templateRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e: any) => e),
    };
    const versionRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e: any) => e),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
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
    return {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([data, total]),
    };
  }

  function createTransactionReq(user?: any) {
    const repos = buildRepos();
    let txCallback: Function;

    const manager = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === DataCollectionTemplate) return repos.templateRepo;
        if (entity === TemplateVersion) return repos.versionRepo;
        throw new Error(`Unexpected repo in tx: ${entity?.name}`);
      }),
    };

    const transaction = jest.fn().mockImplementation(async (cb: Function) => {
      txCallback = cb;
      return cb(manager);
    });

    return {
      tenantConnection: { manager: { transaction } },
      user: user ?? { id: 1 },
      ...repos,
      _transaction: transaction,
      _manager: manager,
    } as any;
  }

  describe('findAll', () => {
    it('returns paginated versions for a template', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1 });
      const qb = createQb([{ id: 1, versionNumber: 1 }], 1);
      req.versionRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(req, 1, { page: 1, limit: 10 });

      expect(result.success).toBe(true);
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('throws NotFoundException when template not found', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.findAll(req, 999, {})).rejects.toThrow(NotFoundException);
    });

    it('defaults page=1, limit=15', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1 });
      const qb = createQb([], 0);
      req.versionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(req, 1, {});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(15);
    });
  });

  describe('findOne', () => {
    it('returns version by id and templateId', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockResolvedValue({ id: 1, templateId: 1, versionNumber: 1 });

      const result = await service.findOne(req, 1, 1);

      expect(result.success).toBe(true);
      expect(result.data.versionNumber).toBe(1);
    });

    it('throws NotFoundException when version not found', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(req, 1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActive', () => {
    it('returns the active version', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockResolvedValue({ id: 3, isActive: true, versionNumber: 3 });

      const result = await service.findActive(req, 1);

      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(req.versionRepo.findOne).toHaveBeenCalledWith({
        where: { templateId: 1, isActive: true },
        order: { versionNumber: 'DESC' },
      });
    });

    it('throws NotFoundException when no active version', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockResolvedValue(null);

      await expect(service.findActive(req, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('restores template schema from target version', async () => {
      const req = createTransactionReq();
      const template = { id: 1, schema: null, status: 'active', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 2, schemaSnapshot: { sections: [] }, isActive: false, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue(targetVersion);

      const result = await service.restore(req, 1, 2);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Template version restored successfully');
      expect(template.schema).toEqual({ sections: [] });
      expect(template.status).toBe(TemplateStatus.DRAFT);
    });

    it('deactivates all active versions and activates target', async () => {
      const req = createTransactionReq();
      const template = { id: 1, schema: null, status: 'active', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 2, schemaSnapshot: {}, isActive: false, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue(targetVersion);

      await service.restore(req, 1, 2);

      expect(req.versionRepo.update).toHaveBeenCalledWith(
        { templateId: 1, isActive: true },
        expect.objectContaining({ isActive: false }),
      );
      expect(targetVersion.isActive).toBe(true);
    });

    it('sets updatedBy from req.user.id', async () => {
      const req = createTransactionReq({ id: 42 });
      const template = { id: 1, schema: null, status: 'active', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 1, schemaSnapshot: {}, isActive: false, updatedBy: null };
      req.templateRepo.findOne.mockResolvedValue(template);
      req.versionRepo.findOne.mockResolvedValue(targetVersion);

      await service.restore(req, 1, 1);

      expect(template.updatedBy).toBe(42);
      expect(targetVersion.updatedBy).toBe(42);
    });

    it('throws NotFoundException when template not found', async () => {
      const req = createTransactionReq();
      req.templateRepo.findOne.mockResolvedValue(null);

      await expect(service.restore(req, 999, 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target version not found', async () => {
      const req = createTransactionReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1 });
      req.versionRepo.findOne.mockResolvedValue(null);

      await expect(service.restore(req, 1, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('error handling', () => {
    it('wraps errors as InternalServerErrorException in findAll', async () => {
      const req = createReq();
      req.templateRepo.findOne.mockResolvedValue({ id: 1 });
      req.versionRepo.createQueryBuilder.mockImplementation(() => {
        throw new Error('DB error');
      });

      await expect(service.findAll(req, 1, {})).rejects.toThrow(InternalServerErrorException);
    });

    it('wraps errors as InternalServerErrorException in findOne', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.findOne(req, 1, 1)).rejects.toThrow(InternalServerErrorException);
    });

    it('wraps errors as InternalServerErrorException in findActive', async () => {
      const req = createReq();
      req.versionRepo.findOne.mockRejectedValue(new Error('DB error'));

      await expect(service.findActive(req, 1)).rejects.toThrow(InternalServerErrorException);
    });
  });
});
