import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FormsService } from './forms.service';
import { AuditLogService } from './audit-log.service';
import { DynamicFieldsService } from './dynamic-fields.service';
import { DynamicModule, Form, FormStatus, FormVersion } from '../entities';
import { FORM_BUILDER_MODULE_SEEDS } from '../config/module-seeds';

describe('FormsService', () => {
  let service: FormsService;
  let auditLogService: jest.Mocked<AuditLogService>;
  let dynamicFieldsService: jest.Mocked<DynamicFieldsService>;

  function repos() {
    const moduleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => (Array.isArray(e) ? e : e)),
    };
    const formRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((e: any) => e),
      save: jest.fn().mockImplementation(async (e: any) => (Array.isArray(e) ? e : { id: 1, ...e })),
      softDelete: jest.fn().mockResolvedValue(undefined),
    };
    const versionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e: any) => e),
      create: jest.fn().mockImplementation((e: any) => e),
      update: jest.fn().mockResolvedValue(undefined),
    };
    return { moduleRepo, formRepo, versionRepo };
  }

  function createReq(r: ReturnType<typeof repos>, user?: any) {
    return {
      tenantConnection: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity === DynamicModule) return r.moduleRepo;
          if (entity === Form) return r.formRepo;
          if (entity === FormVersion) return r.versionRepo;
          throw new Error(`Unexpected entity: ${entity?.name}`);
        }),
        manager: {
          transaction: jest.fn().mockImplementation(async (cb: Function) => {
            const manager = {
              getRepository: jest.fn().mockImplementation((entity: any) => {
                if (entity === Form) return r.formRepo;
                if (entity === FormVersion) return r.versionRepo;
                throw new Error(`Unexpected tx entity: ${entity?.name}`);
              }),
            };
            return cb(manager);
          }),
        },
      },
      user: user ?? { id: 1 },
    } as any;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    auditLogService = { log: jest.fn().mockResolvedValue(undefined) } as any;
    dynamicFieldsService = {
      backfillMissingFieldIds: jest.fn().mockImplementation((fields: any[]) => ({ fields, changed: false })),
      normalizeFieldAlias: jest.fn().mockImplementation((v: string) => v?.toLowerCase().replace(/[^a-z0-9]+/g, '_')),
      migrateDynamicDataKeysOnSchemaChange: jest.fn().mockResolvedValue(undefined),
    } as any;
    service = new FormsService(null as any, auditLogService, dynamicFieldsService, {
      ensureBundledLogoReference: jest.fn().mockReturnValue({
        url: 'http://localhost:3000/uploads/local/reference/eusocial-logo.png',
        path: '/uploads/local/reference/eusocial-logo.png',
        key: 'local/reference/eusocial-logo.png',
        fileName: 'eusocial-logo.png',
        mimeType: 'image/png',
        size: 1024,
        purpose: 'reference',
      }),
    } as any);
  });

  describe('findAll', () => {
    it('returns all forms', async () => {
      const r = repos();
      r.formRepo.find.mockResolvedValue([{ id: 1, name: 'Form 1' }]);
      const req = createReq(r);

      const result = await service.findAll(req);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.data[0].type).toBe('static');
      expect(r.formRepo.find).toHaveBeenCalledWith({
        relations: ['module'],
        order: { createdAt: 'DESC' },
      });
    });

    it('marks form-builder modules as dynamic and lookup modules as static', async () => {
      const r = repos();
      r.formRepo.find.mockResolvedValue([
        { id: 3, name: 'Vendors Form', module: { slug: 'vendors' } },
        { id: 7, name: 'Countries Form', module: { slug: 'countries' } },
        { id: 9, name: 'Cities Form', module: { slug: 'cities' } },
      ]);
      const req = createReq(r);

      const result = await service.findAll(req);

      expect(result.data.map((form: any) => ({ slug: form.module.slug, type: form.type }))).toEqual([
        { slug: 'vendors', type: 'dynamic' },
        { slug: 'countries', type: 'static' },
        { slug: 'cities', type: 'static' },
      ]);
    });
  });

  describe('findOne', () => {
    it('returns a form by id', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, name: 'Test', module: { slug: 'users' } });
      const req = createReq(r);

      const result = await service.findOne(req, 1);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.data.type).toBe('dynamic');
    });

    it('throws NotFoundException when form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.findOne(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a form under a module', async () => {
      const r = repos();
      r.moduleRepo.findOne.mockResolvedValue({ id: 1, name: 'Users', slug: 'users' });
      r.formRepo.save.mockResolvedValue({ id: 10, moduleId: 1, name: 'Users Form', status: FormStatus.DRAFT });
      const req = createReq(r);

      const result = await service.create(req, { moduleId: 1, name: 'Users Form' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form created successfully');
      expect(result.data.type).toBe('dynamic');
      expect(auditLogService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when module not found', async () => {
      const r = repos();
      r.moduleRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.create(req, { moduleId: 999, name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates form name', async () => {
      const r = repos();
      const form = { id: 1, name: 'Old Name', updatedBy: null };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue({ ...form, name: 'New Name' });
      const req = createReq(r);

      const result = await service.update(req, 1, { name: 'New Name' });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form updated successfully');
      expect(auditLogService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.update(req, 999, { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes a form', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, name: 'Form' });
      const req = createReq(r);

      const result = await service.remove(req, 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form deleted successfully');
      expect(result.deletedId).toBe(1);
      expect(r.formRepo.softDelete).toHaveBeenCalledWith({ id: 1 });
      expect(auditLogService.log).toHaveBeenCalled();
    });

    it('throws NotFoundException when form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.remove(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveSchema', () => {
    it('saves a schema and publishes by default', async () => {
      const r = repos();
      const form = {
        id: 1,
        moduleId: 1,
        status: FormStatus.DRAFT,
        autosaveSchema: null,
        updatedBy: null,
        module: { slug: 'users' },
      };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue(form);
      const req = createReq(r);

      const result = await service.saveSchema(req, 1, {
        schema: { fields: [{ fieldKey: 'name', label: 'Name', name: 'name' }] },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form schema saved successfully');
      expect(dynamicFieldsService.migrateDynamicDataKeysOnSchemaChange).toHaveBeenCalled();
    });

    it('saves as draft when markAsDraft is true', async () => {
      const r = repos();
      const form = {
        id: 1,
        moduleId: 1,
        status: FormStatus.PUBLISHED,
        autosaveSchema: null,
        updatedBy: null,
        module: { slug: 'users' },
      };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue(form);
      const req = createReq(r);

      const result = await service.saveSchema(req, 1, {
        schema: { fields: [{ fieldKey: 'name', label: 'Name', name: 'name' }] },
        markAsDraft: true,
      });

      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.saveSchema(req, 999, {
        schema: { fields: [] },
      })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when schema is not an object', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, module: { slug: 'users' } });
      const req = createReq(r);

      await expect(service.saveSchema(req, 1, {
        schema: 'invalid' as any,
      })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when fields contain duplicates', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, module: { slug: 'users' } });
      const req = createReq(r);

      await expect(service.saveSchema(req, 1, {
        schema: {
          fields: [
            { fieldKey: 'name', label: 'Name', name: 'name' },
            { fieldKey: 'name', label: 'Duplicate', name: 'name' },
          ],
        },
      })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when field has no key or name', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, module: { slug: 'users' } });
      const req = createReq(r);

      await expect(service.saveSchema(req, 1, {
        schema: { fields: [{ label: 'No Key' }] },
      })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when field has no label', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, module: { slug: 'users' } });
      const req = createReq(r);

      await expect(service.saveSchema(req, 1, {
        schema: { fields: [{ fieldKey: 'name', name: 'name' }] },
      })).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when validation has no ruleType', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue({ id: 1, module: { slug: 'users' } });
      const req = createReq(r);

      await expect(service.saveSchema(req, 1, {
        schema: {
          fields: [{
            fieldKey: 'name',
            label: 'Name',
            name: 'name',
            validations: [{ ruleType: '' }],
          }],
        },
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('publish', () => {
    it('creates a new version and sets status to PUBLISHED', async () => {
      const r = repos();
      const form = { id: 1, autosaveSchema: { fields: [] }, status: 'draft', updatedBy: null, module: { slug: 'users' } };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue(form);
      r.versionRepo.findOne.mockResolvedValue(null);
      r.versionRepo.save.mockResolvedValue({ id: 1, versionNumber: 1 });
      const req = createReq(r);

      const result = await service.publish(req, 1);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Form published successfully');
      expect(r.versionRepo.save).toHaveBeenCalled();
      expect(form.status).toBe(FormStatus.PUBLISHED);
      expect(auditLogService.log).toHaveBeenCalled();
    });

    it('increments version number from latest', async () => {
      const r = repos();
      const form = { id: 1, autosaveSchema: {}, status: 'draft', updatedBy: null, module: {} };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue(form);
      r.versionRepo.findOne.mockResolvedValue({ versionNumber: 5 });
      r.versionRepo.save.mockResolvedValue({ id: 2, versionNumber: 6 });
      const req = createReq(r);

      await service.publish(req, 1);

      expect(r.versionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ versionNumber: 6 }),
      );
    });

    it('deactivates previous active versions', async () => {
      const r = repos();
      const form = { id: 1, autosaveSchema: {}, status: 'draft', updatedBy: null, module: {} };
      r.formRepo.findOne.mockResolvedValue(form);
      r.formRepo.save.mockResolvedValue(form);
      r.versionRepo.findOne.mockResolvedValue(null);
      r.versionRepo.save.mockResolvedValue({});
      const req = createReq(r);

      await service.publish(req, 1);

      expect(r.versionRepo.update).toHaveBeenCalledWith(
        { formId: 1, isActive: true },
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws NotFoundException when form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.publish(req, 999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getModules', () => {
    it('returns active modules', async () => {
      const r = repos();
      r.moduleRepo.find.mockResolvedValue([{ slug: 'users', name: 'Users' }]);
      const req = createReq(r);

      const result = await service.getModules(req);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.data[0].type).toBe('dynamic');
    });
  });

  describe('error handling', () => {
    it('throws NotFoundException when findOne form not found', async () => {
      const r = repos();
      r.formRepo.findOne.mockResolvedValue(null);
      const req = createReq(r);

      await expect(service.findOne(req, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
