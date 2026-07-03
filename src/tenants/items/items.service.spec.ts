import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { Item } from './entities';
import { ItemsService } from './items.service';
import { DynamicFieldsService } from '../form-builder/services';

describe('ItemsService dynamic fields', () => {
  let service: ItemsService;

  const dynamicFieldsService = new DynamicFieldsService();

  const baseRepoForCtor = { target: Item };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseRepoForCtor),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ItemsService(dataSourceMock, dynamicFieldsService);
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
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'items' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { id: 'fld_item_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_item_no', fieldKey: 'item_no', isSystemField: false },
            { id: 'fld_item_cost', fieldKey: 'cost', isSystemField: false },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    return { moduleRepo, formRepo, versionRepo };
  }

  it('create stores custom fields in entity_dynamic_data and returns field-id keyed data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const itemRepo = {
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => ({
        id: 1,
        name: payload.name,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 1,
          data: { item_no: 'ITM-1001', cost: '120.50' },
        }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      name: 'Beef Sirloin',
      item_no: 'ITM-1001',
      cost: '120.50',
    });

    expect(itemRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Beef Sirloin', createdBy: 99, updatedBy: 99 }),
    );
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 10,
        entityId: 1,
        formVersionId: 30,
        data: expect.objectContaining({ fld_item_no: 'ITM-1001', fld_item_cost: '120.50' }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.fld_item_name).toBe('Beef Sirloin');
    expect(result.data.fld_item_no).toBe('ITM-1001');
    expect(result.data.fld_item_cost).toBe('120.50');
    expect(result.data.id).toBe(1);
    // human-readable field keys are intentionally omitted
    expect(result.data.name).toBeUndefined();
    expect(result.data.item_no).toBeUndefined();
  });

  it('create throws when name is missing', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const itemRepo = { create: jest.fn(), save: jest.fn() };
    const dynamicRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await expect(service.create(req, { item_no: 'ITM-1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(itemRepo.save).not.toHaveBeenCalled();
    expect(dynamicRepo.save).not.toHaveBeenCalled();
  });

  it('update merges new dynamic fields with existing dynamic data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const itemRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'Beef Sirloin',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      }),
      save: jest.fn().mockImplementation(async (payload) => payload),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { item_no: 'ITM-1001', cost: '120.50' } })
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { item_no: 'ITM-1001', cost: '120.50' } })
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { item_no: 'ITM-1001', cost: '99.99' } }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 1, { name: 'Beef Tenderloin', cost: '99.99' });

    expect(itemRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Beef Tenderloin' }));
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fld_item_no: 'ITM-1001', fld_item_cost: '99.99' }),
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data.fld_item_name).toBe('Beef Tenderloin');
    expect(result.data.fld_item_cost).toBe('99.99');
  });

  it('search by system field name filters on the item table', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'Beef Sirloin', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const itemRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { item_no: 'ITM-1001' } }]),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { name: 'Beef' });

    expect(qb.andWhere).toHaveBeenCalledWith('item.name ILIKE :name', { name: '%Beef%' });
    expect(dynamicRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_item_name).toBe('Beef Sirloin');
    expect(result.data[0].fld_item_no).toBe('ITM-1001');
  });

  it('search by custom field filters via entity_dynamic_data (accepts field id key)', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'Beef Sirloin', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const dynamicFilterQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ entityId: '1' }]),
    };

    const itemRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(dynamicFilterQb),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { item_no: 'ITM-1001' } }]),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    // filter keyed by the stable field id
    const result = await service.search(req, 15, { fld_item_no: 'ITM-1001' });

    expect(dynamicRepo.createQueryBuilder).toHaveBeenCalledWith('dynamic');
    expect(qb.andWhere).toHaveBeenCalledWith('item.id IN (:...dynamicIds)', { dynamicIds: [1] });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_item_no).toBe('ITM-1001');
  });

  it('paginate returns field-id keyed rows', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const itemRepo = {
      findAndCount: jest.fn().mockResolvedValue([
        [{ id: 1, name: 'Beef Sirloin', createdAt: new Date(), updatedAt: new Date() }],
        1,
      ]),
    };

    const dynamicRepo = {
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { item_no: 'ITM-1001' } }]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Item, itemRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.paginate(req, 1, [], 15);

    expect(result.success).toBe(true);
    expect(result.meta.total).toBe(1);
    expect(result.data[0].fld_item_name).toBe('Beef Sirloin');
    expect(result.data[0].fld_item_no).toBe('ITM-1001');
  });
});
