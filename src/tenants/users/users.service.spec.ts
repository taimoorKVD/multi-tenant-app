import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MailService } from '../../mail/mail.service';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { JobPosition } from '../job-positions/entities';
import { Location } from '../locations/entities';
import { Role } from '../role/entities';
import { User } from './entities';
import { UsersService } from './users.service';

describe('UsersService dynamic fields', () => {
  let service: UsersService;

  const baseUserRepoForCtor = {
    target: User,
  };

  const dataSourceMock = {
    getRepository: jest.fn().mockReturnValue(baseUserRepoForCtor),
  } as unknown as DataSource;

  const mailServiceMock = {
    sendTemplateMail: jest.fn().mockResolvedValue({ status: 'queued' }),
  } as unknown as MailService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(dataSourceMock, mailServiceMock);
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
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { fieldKey: 'name', isSystemField: true, isRequired: true },
            { fieldKey: 'email', isSystemField: true, isRequired: true },
            { fieldKey: 'password', isSystemField: true, isRequired: true },
            { fieldKey: 'role_id', isSystemField: true, isRequired: true },
            { fieldKey: 'phone_number', isSystemField: true, isRequired: false },
            { fieldKey: 'favorite_color', isSystemField: false, isRequired: false },
          ],
        },
      }),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    return { moduleRepo, formRepo, versionRepo };
  }

  it('create stores additional form-builder fields in entity_dynamic_data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const roleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Admin' }),
    };

    const userRepo = {
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => ({ id: 101, ...payload })),
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: null,
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 101,
          data: {
            favorite_color: 'blue',
            employee_code: 'EMP-001',
            department: 'Operations',
            nickname: 'JD',
          },
        }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, roleRepo],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      name: 'John Doe',
      email: 'john@kingdomvision.com',
      username: 'john',
      password: 'Secret123!',
      password_confirm: 'Secret123!',
      role_id: 1,
      favorite_color: 'blue',
      employee_code: 'EMP-001',
      department: 'Operations',
      nickname: 'JD',
    });

    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 10,
        entityId: 101,
        formVersionId: 30,
        data: expect.objectContaining({
          favorite_color: 'blue',
          employee_code: 'EMP-001',
          department: 'Operations',
          nickname: 'JD',
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.favorite_color).toBe('blue');
    expect(result.data.employee_code).toBe('EMP-001');
    expect(result.data.department).toBe('Operations');
    expect(result.data.nickname).toBe('JD');
    expect(result.data.name).toBe('John Doe');
    expect((mailServiceMock.sendTemplateMail as any)).not.toHaveBeenCalled();
  });

  it('rejects create when a required form-builder field is missing', async () => {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { fieldKey: 'name', isSystemField: true, isRequired: true },
            { fieldKey: 'email', isSystemField: true, isRequired: true },
            { fieldKey: 'password', isSystemField: true, isRequired: true },
            { fieldKey: 'favorite_color', label: 'Favorite Color', isSystemField: false, isRequired: 'true' },
          ],
        },
      }),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const userRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const dynamicRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await expect(
      service.create(req, {
        name: 'John Doe',
        email: 'john@kingdomvision.com',
        password: 'Secret123!',
        password_confirm: 'Secret123!',
      }),
    ).rejects.toMatchObject({
      response: {
        message: ['Favorite Color is required'],
        fields: {
          favorite_color: 'Favorite Color is required',
        },
      },
    });

    expect(userRepo.create).not.toHaveBeenCalled();
    expect(dynamicRepo.save).not.toHaveBeenCalled();
  });

  it('allows create when an optional user field was removed from the form schema', async () => {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { fieldKey: 'email', label: 'Email', isSystemField: true, isRequired: true },
            { fieldKey: 'password', label: 'Password', isSystemField: true, isRequired: true },
          ],
        },
      }),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 101,
          name: null,
          email: 'john@kingdomvision.com',
          phoneNumber: null,
          address: null,
          username: null,
          plainPassword: 'Secret123!',
          password: 'hash',
          role: null,
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => ({ id: 101, ...payload })),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 101,
          data: {},
        }),
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      email: 'john@kingdomvision.com',
      password: 'Secret123!',
      password_confirm: 'Secret123!',
    });

    expect(userRepo.create).toHaveBeenCalledWith({});
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@kingdomvision.com',
        password: 'Secret123!',
      }),
    );
    expect(result.success).toBe(true);
    expect(result.data.name).toBeNull();
  });

  it('update preserves job position and location when omitted or null in payload', async () => {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            {
              fieldKey: 'name_new',
              label: 'Name',
              isSystemField: true,
              systemMappingKey: 'name',
            },
            { fieldKey: 'email', isSystemField: true, isRequired: true },
            { fieldKey: 'select_field', isSystemField: false, isRequired: false },
          ],
        },
      }),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const jobPosition = { id: 2, name: 'Shift Manager', description: null, createdAt: new Date(), updatedAt: new Date() };
    const location = {
      id: 3,
      name: 'Downtown',
      address: 'Main St',
      countryId: 1,
      stateId: 2,
      cityId: 3,
      postalCode: '10001',
      latitude: '',
      longitude: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingUser = {
      id: 101,
      name: 'Old Name',
      email: 'john@acme.com',
      phoneNumber: '+1 555 000',
      address: 'Old address',
      username: 'john',
      plainPassword: 'Secret123!',
      password: 'hash',
      role: { id: 1, name: 'Admin', createdAt: new Date(), updatedAt: new Date(), permissions: [] },
      jobPosition,
      location,
      availabilityDays: ['true', 'false'],
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce({ ...existingUser, name: 'Desirae Hall' }),
      save: jest.fn().mockImplementation(async (payload) => payload),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ moduleId: 10, entityId: 101, data: {} })
        .mockResolvedValueOnce({ moduleId: 10, entityId: 101, data: {} })
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 101,
          data: { select_field: 'Option 1' },
        }),
      create: jest.fn(),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 101, {
      name: null,
      name_new: 'Desirae Hall',
      email: 'john@acme.com',
      job_position_id: null,
      location_id: null,
      select_field: 'Option 1',
    });

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Desirae Hall',
        jobPosition,
        location,
      }),
    );
    expect(result.data.name).toBe('Desirae Hall');
    expect(result.data.job_position?.id).toBe(2);
    expect(result.data.location?.id).toBe(3);
    expect(result.data.select_field).toBe('Option 1');
    expect(result.data.name_new).toBeUndefined();
  });

  it('update merges new dynamic fields with existing dynamic data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: null,
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: '+1 555 000',
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      save: jest.fn().mockImplementation(async (payload) => payload),
    };

    const existingDynamicRow = {
      id: 500,
      moduleId: 10,
      entityId: 101,
      formVersionId: 30,
      data: {
        favorite_color: 'red',
        legacy_tag: 'old-value',
      },
      updatedBy: null,
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(existingDynamicRow)
        .mockResolvedValueOnce(existingDynamicRow)
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 101,
          data: {
            favorite_color: 'blue',
            legacy_tag: 'old-value',
            employee_code: 'EMP-009',
            emergency_contact: '+1 999 111',
          },
        }),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 101, {
      phone_number: '+1 555 000',
      favorite_color: 'blue',
      employee_code: 'EMP-009',
      emergency_contact: '+1 999 111',
    });

    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          favorite_color: 'blue',
          legacy_tag: 'old-value',
          employee_code: 'EMP-009',
          emergency_contact: '+1 999 111',
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.favorite_color).toBe('blue');
    expect(result.data.legacy_tag).toBe('old-value');
    expect(result.data.employee_code).toBe('EMP-009');
    expect(result.data.emergency_contact).toBe('+1 999 111');
    expect(result.data.phone_number).toBe('+1 555 000');
  });

  it('throws when updating a user removes a required form-builder field', async () => {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { fieldKey: 'name', isSystemField: true, isRequired: true },
            { fieldKey: 'email', isSystemField: true, isRequired: true },
            { fieldKey: 'password', isSystemField: true, isRequired: true },
            { fieldKey: 'role_id', isSystemField: true, isRequired: true },
            { fieldKey: 'phone_number', isSystemField: true, isRequired: false },
            { fieldKey: 'favorite_color', isSystemField: false, isRequired: true },
          ],
        },
      }),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const userRepo = {
      findOne: jest.fn()
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: null,
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: null,
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      save: jest.fn().mockResolvedValue({
        id: 101,
        name: 'John Doe',
        email: 'john@acme.com',
        phoneNumber: null,
        address: null,
        username: 'john',
        plainPassword: 'Secret123!',
        password: 'hash',
        role: { id: 1, name: 'Admin' },
        jobPosition: null,
        location: null,
        availabilityDays: null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const dynamicRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({
          moduleId: 10,
          entityId: 101,
          data: { favorite_color: 'red' },
        }),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await expect(service.update(req, 101, { favorite_color: '' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userRepo.findOne).toHaveBeenCalled();
    expect(dynamicRepo.save).not.toHaveBeenCalled();
  });

  it('search filters users by dynamic custom fields from entity_dynamic_data', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          phoneNumber: null,
          address: null,
          username: 'john',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          jobPosition: null,
          location: null,
          availabilityDays: null,
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };

    const dynamicFilterQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([{ entityId: '101' }]),
    };

    const userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const dynamicRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(dynamicFilterQb),
      find: jest.fn().mockResolvedValue([
        {
          moduleId: 10,
          entityId: 101,
          data: { department: 'Operations', employee_code: 'EMP-001' },
        },
      ]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.search(req, 20, {
      dynamicFilters: { department: 'Operations' },
    });

    expect(dynamicRepo.createQueryBuilder).toHaveBeenCalledWith('dynamic');
    expect(dynamicFilterQb.andWhere).toHaveBeenCalled();
    expect(qb.andWhere).toHaveBeenCalledWith('user.id IN (:...dynamicIds)', { dynamicIds: [101] });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.data[0].department).toBe('Operations');
  });

  it('search filters users by address text', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();

    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const dynamicRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [JobPosition, { findOne: jest.fn() }],
      [Location, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await service.search(req, 20, {
      address: 'Elm',
    });

    expect(qb.andWhere).toHaveBeenCalledWith('user.address ILIKE :address', { address: '%Elm%' });
  });
});
