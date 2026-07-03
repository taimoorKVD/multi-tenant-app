import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { Location } from './entities';
import { LocationsService } from './locations.service';
import { DynamicFieldsService } from '../form-builder/services';

describe('LocationsService dynamic fields', () => {
  let service: LocationsService;

  const dynamicFieldsService = new DynamicFieldsService();

  const baseRepoForCtor = { target: Location };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseRepoForCtor),
  } as unknown as DataSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LocationsService(dataSourceMock, dynamicFieldsService);
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
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'locations' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { id: 'fld_loc_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_loc_address', fieldKey: 'address', isSystemField: true, systemMappingKey: 'address' },
            { id: 'fld_loc_country', fieldKey: 'country_id', isSystemField: true, systemMappingKey: 'country_id' },
            { id: 'fld_loc_postal', fieldKey: 'postalCode', isSystemField: true, systemMappingKey: 'postalCode' },
            { id: 'fld_loc_note', fieldKey: 'note', isSystemField: false },
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

  it('create maps system fields to columns and custom fields to entity_dynamic_data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const locationRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockImplementation(async (entity) => ({
        id: 1,
        name: entity.name,
        address: entity.address,
        countryId: entity.countryId ?? null,
        stateId: entity.stateId ?? null,
        cityId: entity.cityId ?? null,
        postalCode: entity.postalCode,
        latitude: entity.latitude,
        longitude: entity.longitude,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      })),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { note: 'Main branch' } }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      name: 'HQ',
      address: '123 Main St',
      country_id: '5',
      postalCode: '10001',
      note: 'Main branch',
    });

    expect(locationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'HQ', address: '123 Main St', countryId: 5, postalCode: '10001' }),
    );
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: 'Main branch' }) }),
    );

    expect(result.success).toBe(true);
    expect(result.data.fld_loc_name).toBe('HQ');
    expect(result.data.fld_loc_address).toBe('123 Main St');
    expect(result.data.fld_loc_country).toBe(5);
    expect(result.data.fld_loc_postal).toBe('10001');
    expect(result.data.fld_loc_note).toBe('Main branch');
    expect(result.data.name).toBeUndefined();
  });

  it('create throws when name is missing', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const locationRepo = { create: jest.fn().mockReturnValue({}), save: jest.fn() };
    const dynamicRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await expect(service.create(req, { address: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(locationRepo.save).not.toHaveBeenCalled();
  });

  it('update applies system columns and merges dynamic data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const locationRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        name: 'HQ',
        address: '123 Main St',
        countryId: 5,
        stateId: null,
        cityId: null,
        postalCode: '10001',
        latitude: null,
        longitude: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      }),
      save: jest.fn().mockImplementation(async (entity) => entity),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { note: 'old' } })
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { note: 'old' } })
        .mockResolvedValueOnce({ moduleId: 10, entityId: 1, data: { note: 'updated' } }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 1, { name: 'HQ West', note: 'updated' });

    expect(locationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ name: 'HQ West' }));
    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ note: 'updated' }) }),
    );
    expect(result.success).toBe(true);
    expect(result.data.fld_loc_name).toBe('HQ West');
    expect(result.data.fld_loc_note).toBe('updated');
  });

  it('search by system string column filters on the location table', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'HQ', address: '123 Main St', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const locationRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { note: 'Main branch' } }]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { name: 'HQ' });

    expect(qb.andWhere).toHaveBeenCalledWith('location.name ILIKE :s_name', { s_name: '%HQ%' });
    expect(dynamicRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_loc_name).toBe('HQ');
    expect(result.data[0].fld_loc_note).toBe('Main branch');
  });

  it('search by system int column (via field id) filters by equality', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'HQ', countryId: 5, createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const locationRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { fld_loc_country: '5' });

    expect(qb.andWhere).toHaveBeenCalledWith('location.countryId = :i_country_id', { i_country_id: 5 });
    expect(dynamicRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it('search by custom field filters via entity_dynamic_data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: 1, name: 'HQ', createdAt: new Date(), updatedAt: new Date() },
      ]),
    };

    const dynamicFilterQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ entityId: '1' }]),
    };

    const locationRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const dynamicRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(dynamicFilterQb),
      find: jest.fn().mockResolvedValue([{ entityId: 1, data: { note: 'Main branch' } }]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [Location, locationRepo],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 15, { note: 'Main' });

    expect(dynamicRepo.createQueryBuilder).toHaveBeenCalledWith('dynamic');
    expect(qb.andWhere).toHaveBeenCalledWith('location.id IN (:...dynamicIds)', { dynamicIds: [1] });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].fld_loc_note).toBe('Main branch');
  });
});
