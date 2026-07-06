import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { DynamicFieldsService } from '../form-builder/services';
import { Vendor } from './entities';
import { VendorsService } from './vendors.service';

describe('VendorsService dynamic fields', () => {
  let service: VendorsService;

  const dynamicFieldsService = new DynamicFieldsService();

  const baseRepoForCtor = { target: Vendor };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseRepoForCtor),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VendorsService(dataSourceMock, dynamicFieldsService);
  });

  function buildReq(repos: Map<any, any>) {
    return {
      tenantId: 'kingdomvision',
      user: { id: 99 },
      tenantConnection: {
        options: { database: 'tenant_kingdomvision' },
        getRepository: jest.fn().mockImplementation((entity: any) => {
          const repo = repos.get(entity);
          if (!repo) {
            throw new Error(`Unexpected repository request: ${entity?.name || String(entity)}`);
          }
          return repo;
        }),
      },
    } as any;
  }

  function buildSchemaRepos() {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 11, slug: 'vendors' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 21,
        moduleId: 11,
        autosaveSchema: {
          fields: [
            {
              id: 'fld_vendor_name',
              fieldKey: 'vendor_name',
              name: 'vendor_name',
              isSystemField: true,
              systemMappingKey: 'vendor_name',
              isRequired: true,
            },
            { id: 'fld_email', fieldKey: 'email', isSystemField: false },
            { id: 'fld_phone_number', fieldKey: 'phone_number', isSystemField: false },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 31, isActive: true }),
    };

    return { moduleRepo, formRepo, versionRepo };
  }

  it('create stores custom fields in entity_dynamic_data and returns field-id keyed data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const vendorRepo = {
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => ({
        id: 1,
        vendorName: payload.vendorName,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          moduleId: 11,
          entityId: 1,
          data: { email: 'vendor@example.com', phone_number: '555-0100' },
        }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      vendor_name: 'Fresh Foods Co',
      email: 'vendor@example.com',
      phone_number: '555-0100',
    });

    expect(vendorRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ vendorName: 'Fresh Foods Co', createdBy: 99, updatedBy: 99 }),
    );
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 11,
        entityId: 1,
        formVersionId: 31,
        data: expect.objectContaining({ fld_email: 'vendor@example.com', fld_phone_number: '555-0100' }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.fld_vendor_name).toBe('Fresh Foods Co');
    expect(result.data.fld_email).toBe('vendor@example.com');
    expect(result.data.fld_phone_number).toBe('555-0100');
    expect(result.data.id).toBe(1);
    expect(result.data.vendor_name).toBeUndefined();
    expect(result.data.email).toBeUndefined();
  });

  it('create accepts fld_* keyed payload from the form builder', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const vendorRepo = {
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => ({
        id: 2,
        vendorName: payload.vendorName,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ moduleId: 11, entityId: 2, data: { fld_email: 'test@example.com' } }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      fld_vendor_name: 'Metro Supplies',
      fld_email: 'test@example.com',
    });

    expect(vendorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ vendorName: 'Metro Supplies' }));
    expect(result.success).toBe(true);
    expect(result.data.fld_vendor_name).toBe('Metro Supplies');
    expect(result.data.fld_email).toBe('test@example.com');
  });

  it('create throws when vendor_name is missing', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const vendorRepo = { create: jest.fn(), save: jest.fn() };
    const dynamicRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await expect(service.create(req, { email: 'vendor@example.com' })).rejects.toBeInstanceOf(BadRequestException);
    expect(vendorRepo.save).not.toHaveBeenCalled();
    expect(dynamicRepo.save).not.toHaveBeenCalled();
  });

  it('update merges new dynamic fields with existing dynamic data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const vendorRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        vendorName: 'Fresh Foods Co',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      }),
      save: jest.fn().mockImplementation(async (payload) => payload),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ moduleId: 11, entityId: 1, data: { email: 'old@example.com', phone_number: '555-0100' } })
        .mockResolvedValueOnce({ moduleId: 11, entityId: 1, data: { email: 'old@example.com', phone_number: '555-0100' } })
        .mockResolvedValueOnce({ moduleId: 11, entityId: 1, data: { email: 'new@example.com', phone_number: '555-0100' } }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 1, { vendor_name: 'Fresh Foods LLC', email: 'new@example.com' });

    expect(vendorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ vendorName: 'Fresh Foods LLC' }));
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fld_email: 'new@example.com', fld_phone_number: '555-0100' }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data.fld_vendor_name).toBe('Fresh Foods LLC');
    expect(result.data.fld_email).toBe('new@example.com');
  });

  it('search by system field vendor_name filters on the vendor table', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, vendorName: 'Fresh Foods Co', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const vendorRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { email: 'vendor@example.com' } }]),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { vendor_name: 'Fresh' });

    expect(qb.andWhere).toHaveBeenCalledWith('vendor.vendorName ILIKE :vendor_name', { vendor_name: '%Fresh%' });
    expect(dynamicRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_vendor_name).toBe('Fresh Foods Co');
    expect(result.data[0].fld_email).toBe('vendor@example.com');
  });

  it('search by custom field filters via entity_dynamic_data (accepts field id key)', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, vendorName: 'Fresh Foods Co', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const dynamicFilterQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ entityId: '1' }]),
    };

    const vendorRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(dynamicFilterQb),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { email: 'vendor@example.com' } }]),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { fld_email: 'vendor@example.com' });

    expect(dynamicRepo.createQueryBuilder).toHaveBeenCalledWith('dynamic');
    expect(qb.andWhere).toHaveBeenCalledWith('vendor.id IN (:...dynamicIds)', { dynamicIds: [1] });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_email).toBe('vendor@example.com');
  });

  it('paginate returns field-id keyed rows', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const vendorRepo = {
      findAndCount: jest.fn().mockResolvedValue([
        [{ id: 1, vendorName: 'Fresh Foods Co', createdAt: new Date(), updatedAt: new Date() }],
        1,
      ]),
    };

    const dynamicRepo = {
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { email: 'vendor@example.com' } }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Vendor, vendorRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.paginate(req, 1, [], 15);

    expect(result.success).toBe(true);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].fld_vendor_name).toBe('Fresh Foods Co');
    expect(result.data[0].fld_email).toBe('vendor@example.com');
  });
});
