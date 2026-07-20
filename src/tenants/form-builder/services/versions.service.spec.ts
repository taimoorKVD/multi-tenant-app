import { NotFoundException } from '@nestjs/common';
import { VersionsService } from './versions.service';
import { Form, FormStatus, FormVersion } from '../entities';

describe('VersionsService', () => {
  let service: VersionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VersionsService(null as any);
  });

  function createRepos() {
    const formRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e: any) => e),
      create: jest.fn().mockImplementation((e: any) => e),
    };
    const versionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e: any) => e),
      create: jest.fn().mockImplementation((e: any) => e),
      update: jest.fn().mockResolvedValue(undefined),
    };
    return { formRepo, versionRepo };
  }

  function createReq(repos: ReturnType<typeof createRepos>, user?: any) {
    return {
      tenantConnection: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === Form) return repos.formRepo;
          if (entity === FormVersion) return repos.versionRepo;
          throw new Error(`Unexpected entity: ${entity?.name}`);
        }),
        manager: {
          transaction: jest.fn().mockImplementation(async (cb: Function) => {
            const manager = {
              getRepository: jest.fn().mockImplementation((entity: any) => {
                if (entity === Form) return repos.formRepo;
                if (entity === FormVersion) return repos.versionRepo;
                throw new Error(`Unexpected entity in tx: ${entity?.name}`);
              }),
            };
            return cb(manager);
          }),
        },
      },
      user: user ?? { id: 1 },
    } as any;
  }

  describe('findAll', () => {
    it('returns versions for a valid moduleSlug', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue({ id: 10 });
      repos.versionRepo.find.mockResolvedValue([{ id: 1, versionNumber: 2 }]);

      const req = createReq(repos);
      const result = await service.findAll(req, 'users');

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(repos.versionRepo.find).toHaveBeenCalledWith({
        where: { formId: 10 },
        order: { versionNumber: 'DESC' },
      });
    });

    it('throws NotFoundException when form not found', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(repos);

      await expect(service.findAll(req, 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns a specific version', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue({ id: 10 });
      repos.versionRepo.findOne.mockResolvedValue({ id: 5, versionNumber: 1 });

      const req = createReq(repos);
      const result = await service.findOne(req, 'users', 1);

      expect(result.success).toBe(true);
      expect(result.data.versionNumber).toBe(1);
    });

    it('throws NotFoundException when form not found', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(repos);

      await expect(service.findOne(req, 'nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when version not found', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue({ id: 10 });
      repos.versionRepo.findOne.mockResolvedValue(null);
      const req = createReq(repos);

      await expect(service.findOne(req, 'users', 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('restore', () => {
    it('restores a form to a prior version', async () => {
      const repos = createRepos();
      const form = { id: 10, autosaveSchema: null, status: 'published', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 1, schemaSnapshot: { fields: [] }, isActive: false, updatedBy: null };
      repos.formRepo.findOne.mockResolvedValue(form);
      repos.versionRepo.findOne.mockResolvedValue(targetVersion);

      const req = createReq(repos);
      const result = await service.restore(req, 'users', 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form version restored successfully');
      expect(form.autosaveSchema).toEqual({ fields: [] });
      expect(form.status).toBe(FormStatus.DRAFT);
    });

    it('deactivates all active versions and activates target', async () => {
      const repos = createRepos();
      const form = { id: 10, autosaveSchema: null, status: 'published', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 1, schemaSnapshot: {}, isActive: false, updatedBy: null };
      repos.formRepo.findOne.mockResolvedValue(form);
      repos.versionRepo.findOne.mockResolvedValue(targetVersion);

      const req = createReq(repos);
      await service.restore(req, 'users', 1);

      expect(repos.versionRepo.update).toHaveBeenCalledWith(
        { formId: 10, isActive: true },
        expect.objectContaining({ isActive: false }),
      );
      expect(targetVersion.isActive).toBe(true);
    });

    it('sets updatedBy from req.user.id', async () => {
      const repos = createRepos();
      const form = { id: 10, autosaveSchema: null, status: 'published', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 1, schemaSnapshot: {}, isActive: false, updatedBy: null };
      repos.formRepo.findOne.mockResolvedValue(form);
      repos.versionRepo.findOne.mockResolvedValue(targetVersion);

      const req = createReq(repos, { id: 42 });
      await service.restore(req, 'users', 1);

      expect(form.updatedBy).toBe(42);
      expect(targetVersion.updatedBy).toBe(42);
    });

    it('sets updatedBy from updatedBy param when provided', async () => {
      const repos = createRepos();
      const form = { id: 10, autosaveSchema: null, status: 'published', updatedBy: null };
      const targetVersion = { id: 5, versionNumber: 1, schemaSnapshot: {}, isActive: false, updatedBy: null };
      repos.formRepo.findOne.mockResolvedValue(form);
      repos.versionRepo.findOne.mockResolvedValue(targetVersion);

      const req = createReq(repos, { id: 1 });
      await service.restore(req, 'users', 1, 99);

      expect(form.updatedBy).toBe(99);
      expect(targetVersion.updatedBy).toBe(99);
    });

    it('throws NotFoundException when form not found', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(repos);

      await expect(service.restore(req, 'nonexistent', 1)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target version not found', async () => {
      const repos = createRepos();
      repos.formRepo.findOne.mockResolvedValue({ id: 10 });
      repos.versionRepo.findOne.mockResolvedValue(null);
      const req = createReq(repos);

      await expect(service.restore(req, 'users', 999)).rejects.toThrow(NotFoundException);
    });
  });
});
