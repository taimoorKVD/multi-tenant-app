import 'dotenv/config';
import { DataSource, Repository } from 'typeorm';
import { getTenantDataSource, tenantConnections } from '../../database/datasource/tenant-datasource';
import { MailService } from '../../mail/mail.service';
import { DynamicModule, EntityDynamicData } from '../form-builder/entities';
import { Role } from '../role/entities';
import { User } from './entities';
import { UsersService } from './users.service';
import { DynamicFieldsService } from '../form-builder/services';

const runRealTenantDbTests = process.env.RUN_REAL_TENANT_DB_TESTS === 'true';
const keepIntegrationData = process.env.KEEP_INTEGRATION_USER === 'true';
const describeIntegration = runRealTenantDbTests ? describe : describe.skip;

describeIntegration('UsersService integration (tenant_kingdomvision)', () => {
  jest.setTimeout(120000);

  let dataSource: DataSource;
  let service: UsersService;

  let userRepo: Repository<User>;
  let roleRepo: Repository<Role>;
  let moduleRepo: Repository<DynamicModule>;
  let dynamicRepo: Repository<EntityDynamicData>;

  let createdUserId: number | null = null;
  let createdRoleId: number | null = null;
  let usersModuleId: number | null = null;

  const mailServiceMock = {
    sendTemplateMail: jest.fn().mockResolvedValue({ status: 'sent' }),
  } as unknown as MailService;

  const permissionSessionSyncMock = {
    syncUsers: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    dataSource = await getTenantDataSource('tenant_kingdomvision');
    service = new UsersService(
      dataSource as any,
      mailServiceMock,
      new DynamicFieldsService(),
      permissionSessionSyncMock as any,
    );

    userRepo = dataSource.getRepository(User);
    roleRepo = dataSource.getRepository(Role);
    moduleRepo = dataSource.getRepository(DynamicModule);
    dynamicRepo = dataSource.getRepository(EntityDynamicData);

    const moduleEntity = await moduleRepo.findOne({ where: { slug: 'users' } });
    if (moduleEntity) {
      usersModuleId = moduleEntity.id;
    } else {
      const createdModule = await moduleRepo.save(
        moduleRepo.create({
          name: 'Users',
          slug: 'users',
          isActive: true,
          createdBy: 1,
          updatedBy: 1,
        }),
      );
      usersModuleId = createdModule.id;
    }

    const roleName = `Integration Role ${Date.now()}`;
    const role = await roleRepo.save(roleRepo.create({ name: roleName }));
    createdRoleId = role.id;
  });

  afterAll(async () => {
    if (!keepIntegrationData && createdUserId) {
      await dynamicRepo.delete({ entityId: createdUserId });
      await userRepo.delete({ id: createdUserId });
    }

    if (!keepIntegrationData && createdRoleId) {
      await roleRepo.delete({ id: createdRoleId });
    }

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
      delete tenantConnections['tenant_kingdomvision'];
    }
  });

  it('creates and updates tenant user with dynamic fields persisted in entity_dynamic_data', async () => {
    if (!usersModuleId || !createdRoleId) {
      throw new Error('Integration test setup failed: users module or role missing');
    }

    const uniqueKey = Date.now();
    const req = {
      tenantId: 'kingdomvision',
      user: { id: 1 },
      tenantConnection: dataSource,
    } as any;

    const createResult = await service.create(req, {
      name: `Integration User ${uniqueKey}`,
      email: `integration.${uniqueKey}@kingdomvision.com`,
      password: 'Secret123!',
      password_confirm: 'Secret123!',
      role_id: createdRoleId,
      favorite_color: 'blue',
      employee_code: `EMP-${uniqueKey}`,
      department: 'QA',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.tenant).toBe('tenant_kingdomvision');
    expect(createResult.data.favorite_color).toBe('blue');
    expect(createResult.data.employee_code).toBe(`EMP-${uniqueKey}`);
    expect(createResult.data.department).toBe('QA');

    createdUserId = createResult.data.id;
    if (!createdUserId) {
      throw new Error('Created user id is missing from create response');
    }

    console.log(
      `[integration] created tenant user id=${createdUserId} email=${createResult.data.email} keep=${keepIntegrationData}`,
    );

    const userId = createdUserId;

    const dbUser = await userRepo.findOne({ where: { id: userId }, relations: ['role'] });
    expect(dbUser).toBeTruthy();
    expect(dbUser?.role?.id).toBe(createdRoleId);

    const dynamicRowAfterCreate = await dynamicRepo.findOne({
      where: { moduleId: usersModuleId, entityId: userId },
    });
    expect(dynamicRowAfterCreate).toBeTruthy();
    expect(dynamicRowAfterCreate?.data).toEqual(
      expect.objectContaining({
        favorite_color: 'blue',
        employee_code: `EMP-${uniqueKey}`,
        department: 'QA',
      }),
    );

    const updateResult = await service.update(req, userId, {
      favorite_color: 'green',
      emergency_contact: '+1 555 0909',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.tenant).toBe('tenant_kingdomvision');
    expect(updateResult.data.favorite_color).toBe('green');
    expect(updateResult.data.emergency_contact).toBe('+1 555 0909');

    const dynamicRowAfterUpdate = await dynamicRepo.findOne({
      where: { moduleId: usersModuleId, entityId: userId },
    });
    expect(dynamicRowAfterUpdate).toBeTruthy();
    expect(dynamicRowAfterUpdate?.data).toEqual(
      expect.objectContaining({
        favorite_color: 'green',
        employee_code: `EMP-${uniqueKey}`,
        department: 'QA',
        emergency_contact: '+1 555 0909',
      }),
    );
  });
});
