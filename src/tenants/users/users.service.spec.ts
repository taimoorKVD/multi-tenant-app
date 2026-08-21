import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MailService } from '../../mail/mail.service';
import { DynamicModule, Form, FormVersion } from '../form-builder/entities';
import { EntityDynamicData } from '../form-builder/entities/entity-dynamic-data.entity';
import { Role } from '../role/entities';
import { JobPosition } from '../job-positions/entities';
import { User } from './entities';
import { UsersService } from './users.service';
import { DynamicFieldsService } from '../form-builder/services';

describe('UsersService dynamic fields', () => {
  let service: UsersService;

  const dynamicFieldsService = new DynamicFieldsService();

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
    service = new UsersService(dataSourceMock, mailServiceMock, dynamicFieldsService);
  });

  function buildReq(repos: Map<any, any>) {
    const defaultJobPositionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    return {
      tenantId: 'kingdomvision',
      user: { id: 99 },
      tenantConnection: {
        options: { database: 'tenant_kingdomvision' },
        getRepository: jest.fn().mockImplementation((entity: any) => {
          const repo = repos.get(entity);
          if (repo) return repo;
          if (entity === JobPosition) return defaultJobPositionRepo;
          throw new Error(`Unexpected repository request: ${entity?.name || String(entity)}`);
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
            { id: 'fld_test_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_test_email', fieldKey: 'email', isSystemField: true, systemMappingKey: 'email', isRequired: true },
            { id: 'fld_test_password', fieldKey: 'password', isSystemField: true, systemMappingKey: 'password', isRequired: true },
            { id: 'fld_test_role_id', fieldKey: 'role_id', isSystemField: true, systemMappingKey: 'role_id', isRequired: true },
            { id: 'fld_test_favorite_color', fieldKey: 'favorite_color', isSystemField: false, isRequired: false },
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
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
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
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.create(req, {
      name: 'John Doe',
      email: 'john@kingdomvision.com',
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
          fld_test_favorite_color: 'blue',
          employee_code: 'EMP-001',
          department: 'Operations',
          nickname: 'JD',
        }),
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.fld_test_favorite_color).toBe('blue');
    expect(result.data.employee_code).toBe('EMP-001');
    expect(result.data.department).toBe('Operations');
    expect(result.data.nickname).toBe('JD');
    expect(result.data.fld_test_name).toBe('John Doe');
    expect(result.credentialsEmail).toEqual({ sent: false, error: expect.any(String) });
    expect((mailServiceMock.sendTemplateMail as any)).not.toHaveBeenCalled();
  });

  it('paginate keeps fld_* keys when a custom field label/fieldKey changed in form builder', async () => {
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { id: 'fld_test_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_test_email', fieldKey: 'email', isSystemField: true, systemMappingKey: 'email', isRequired: true },
            {
              id: 'fld_test_address',
              fieldKey: 'address',
              label: 'Home Address',
              isSystemField: false,
              dataKeys: ['textarea_field', 'address'],
            },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const userRepo = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 6,
            name: 'Simon Patrick',
            email: 'vutunuhy@mailinator.com',
            plainPassword: 'Pa$$w0rd!',
            password: 'hash',
            role: { id: 1, name: 'Admin' },
            isSystem: false,
            createdAt: new Date('2026-07-03T17:00:26.714Z'),
            updatedAt: new Date('2026-07-03T17:00:26.714Z'),
          },
        ],
        1,
      ]),
    };

    const dynamicRepo = {
      find: jest.fn().mockResolvedValue([
        {
          moduleId: 10,
          entityId: 6,
          data: { textarea_field: 'In minim sed neque e' },
        },
      ]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.paginate(req, 1, ['role'], 15);

    expect(result.success).toBe(true);
    expect(result.data[0].fld_test_address).toBe('In minim sed neque e');
    expect(result.data[0].address).toBeUndefined();
    expect(result.data[0].textarea_field).toBeUndefined();
  });

  it('does not shuffle values when one field dataKeys is contaminated with another field id', async () => {
    // Reproduces the bug where one custom field carried another's identifiers
    // in its dataKeys and stole its stored value.
    const moduleRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 10, slug: 'users' }),
    };

    const formRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        moduleId: 10,
        autosaveSchema: {
          fields: [
            { id: 'fld_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            {
              id: 'fld_code',
              fieldKey: 'employee_code',
              label: 'Employee Code',
              isSystemField: false,
              // contaminated: contains department's id + keys
              dataKeys: ['department', 'fld_dept', 'employee_code', 'fld_code'],
            },
            {
              id: 'fld_dept',
              fieldKey: 'department',
              label: 'Department',
              isSystemField: false,
              dataKeys: ['department', 'fld_dept'],
            },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const userRepo = {
      findAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 4,
            name: 'Ryder Hopkins',
            email: 'lovy@mailinator.com',
            plainPassword: 'Pa$$w0rd!',
            password: 'hash',
            role: { id: 1, name: 'Admin' },
            isSystem: false,
            createdAt: new Date('2026-07-03T17:38:34.478Z'),
            updatedAt: new Date('2026-07-03T17:38:34.478Z'),
          },
        ],
        1,
      ]),
    };

    const dynamicRepo = {
      find: jest.fn().mockResolvedValue([
        {
          moduleId: 10,
          entityId: 4,
          // department selected = 1 (stored under its own id), employee code = 379
          data: { fld_dept: 1, fld_code: 379 },
        },
      ]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.paginate(req, 1, ['role'], 15);

    expect(result.success).toBe(true);
    // each field keeps its own value; no shuffle
    expect(result.data[0].fld_code).toBe(379);
    expect(result.data[0].fld_dept).toBe(1);
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
            { id: 'fld_test_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_test_email', fieldKey: 'email', isSystemField: true, systemMappingKey: 'email', isRequired: true },
            { id: 'fld_test_password', fieldKey: 'password', isSystemField: true, systemMappingKey: 'password', isRequired: true },
            { id: 'fld_test_favorite_color', fieldKey: 'favorite_color', label: 'Favorite Color', isSystemField: false, isRequired: 'true' },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
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
            { id: 'fld_test_email', fieldKey: 'email', label: 'Email', isSystemField: true, systemMappingKey: 'email', isRequired: true },
            { id: 'fld_test_password', fieldKey: 'password', label: 'Password', isSystemField: true, systemMappingKey: 'password', isRequired: true },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
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
          plainPassword: 'Secret123!',
          password: 'hash',
          role: null,
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

    const roleRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: { where?: { id?: number; name?: string } }) => {
        if (where?.name === 'Employee') return { id: 2, name: 'Employee' };
        return null;
      }),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, roleRepo],
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
    expect(result.data.fld_test_email).toBe('john@kingdomvision.com');
  });

  it('sends employee account-ready credentials email when a user is created', async () => {
    const { moduleRepo, formRepo, versionRepo } = buildSchemaRepos();
    const roleRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Staff' }) };
    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@kingdomvision.com',
          role: { id: 1, name: 'Staff' },
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 101, ...entity })),
    };
    const dynamicRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((payload) => ({ ...payload })),
      save: jest.fn().mockImplementation(async (payload) => payload),
      delete: jest.fn(),
      find: jest.fn(),
    };
    const req = buildReq(
      new Map<any, any>([
        [User, userRepo],
        [Role, roleRepo],
        [DynamicModule, moduleRepo],
        [Form, formRepo],
        [FormVersion, versionRepo],
        [EntityDynamicData, dynamicRepo],
      ]),
    );

    const sendSpy = jest
      .spyOn(service as any, 'sendEmployeeAccountReadyEmail')
      .mockResolvedValue(undefined);

    const result = await service.create(req, {
      name: 'John Doe',
      email: 'john@kingdomvision.com',
      password: 'Secret123!',
      password_confirm: 'Secret123!',
      role_id: 1,
    });

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'john@kingdomvision.com',
        loginEmail: 'john@kingdomvision.com',
        password: 'Secret123!',
        tenantSlug: 'kingdomvision',
      }),
    );
    expect(result.credentialsEmail).toEqual({ sent: true, error: null });
    sendSpy.mockRestore();
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
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
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
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    const result = await service.update(req, 101, {
      favorite_color: 'blue',
      employee_code: 'EMP-009',
      emergency_contact: '+1 999 111',
    });

    expect(dynamicRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          fld_test_favorite_color: 'blue',
          legacy_tag: 'old-value',
          employee_code: 'EMP-009',
          emergency_contact: '+1 999 111',
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.tenant).toBe('tenant_kingdomvision');
    expect(result.data.fld_test_favorite_color).toBe('blue');
    expect(result.data.legacy_tag).toBe('old-value');
    expect(result.data.employee_code).toBe('EMP-009');
    expect(result.data.emergency_contact).toBe('+1 999 111');
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
            { id: 'fld_test_name', fieldKey: 'name', isSystemField: true, systemMappingKey: 'name', isRequired: true },
            { id: 'fld_test_email', fieldKey: 'email', isSystemField: true, systemMappingKey: 'email', isRequired: true },
            { id: 'fld_test_password', fieldKey: 'password', isSystemField: true, systemMappingKey: 'password', isRequired: true },
            { id: 'fld_test_role_id', fieldKey: 'role_id', isSystemField: true, systemMappingKey: 'role_id', isRequired: true },
            { id: 'fld_test_favorite_color', fieldKey: 'favorite_color', isSystemField: false, isRequired: true },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
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
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: 101,
          name: 'John Doe',
          email: 'john@acme.com',
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
          isSystem: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      save: jest.fn().mockResolvedValue({
        id: 101,
        name: 'John Doe',
        email: 'john@acme.com',
        plainPassword: 'Secret123!',
        password: 'hash',
        role: { id: 1, name: 'Admin' },
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
          plainPassword: 'Secret123!',
          password: 'hash',
          role: { id: 1, name: 'Admin' },
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

  it('search filters users by custom checkbox dynamic field option', async () => {
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
              id: 'fld_test_checkbox',
              fieldKey: 'checkbox_field',
              fieldTypeName: 'checkbox',
              isSystemField: false,
              options: [
                { label: 'Option 1', value: 'option_1' },
                { label: 'Option 2', value: 'option_2' },
              ],
            },
          ],
        },
      }),
      save: jest.fn().mockImplementation((form) => Promise.resolve(form)),
    };

    const versionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 30, isActive: true }),
    };

    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const dynamicFilterQb: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const dynamicRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(dynamicFilterQb),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const repos = new Map<any, any>([
      [User, userRepo],
      [Role, { findOne: jest.fn() }],
      [DynamicModule, moduleRepo],
      [Form, formRepo],
      [FormVersion, versionRepo],
      [EntityDynamicData, dynamicRepo],
    ]);

    const req = buildReq(repos);

    await service.search(req, 15, {
      dynamicFilters: { checkbox_field: 'option_1' },
    });

    expect(dynamicFilterQb.andWhere).toHaveBeenCalledWith(
      `dynamic.data->:key::text @> :value::jsonb`,
      {
        key: 'fld_test_checkbox',
        value: '["option_1"]',
      },
    );
  });
});
