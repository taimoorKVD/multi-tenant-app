import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toDbNameSlug, toSubdomainSlug } from '../../utils';
import {
  getTenantDataSource,
  tenantConnections,
} from '../../database/datasource';
import { Tenant } from './entities';
import { User } from '../../tenants/users/entities';
import * as argon2 from 'argon2';
import { Role } from '../../tenants/role/entities';
import { CreateTenantDto } from './dto';
import { IAdminSetup, ITenantResponse } from './interfaces';
import { Permission } from '../../tenants/permission/entities';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    try {
      const tenants = await this.tenantRepo.find({
        order: { id: 'DESC' },
      });

      return {
        success: true,
        message: tenants.length
          ? `${tenants.length} tenants found`
          : 'No tenants available',
        count: tenants.length,
        data: tenants.map((t) => ({
          id: t.id,
          name: t.name,
          dbName: t.dbName,
          subDomain: t.subdomain,
          customDomain: t.customDomain,
          createdAt: t.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch tenants:', error.stack);

      throw new InternalServerErrorException(
        'An unexpected error occurred while retrieving tenants',
      );
    }
  }

  /**
   * Create a new tenant with rollback on error.
   */
  async create(dto: CreateTenantDto): Promise<ITenantResponse> {
    const { name, customDomain } = dto;
    const tenantName = name?.trim();
    if (!tenantName) throw new BadRequestException('Tenant name is required');

    let dbName = '';
    let tenantRecord: Tenant | null = null;
    let tenantConnection: DataSource | null = null;

    try {
      const { subdomain } = await this.ensureUniqueTenant(tenantName);
      dbName = toDbNameSlug(tenantName, 'tenant_');

      tenantRecord = this.tenantRepo.create({
        name: tenantName,
        dbName,
        subdomain,
        customDomain: customDomain || null,
      });
      await this.tenantRepo.save(tenantRecord);
      this.logger.log(`🟢 Tenant metadata saved: ${tenantName} -> ${dbName}`);

      await this.createDatabase(dbName);

      tenantConnection = await getTenantDataSource(dbName);
      await tenantConnection.synchronize();

      const adminSetup = await this.bootstrapAdmin(tenantConnection, subdomain);

      return this.buildResponse(
        tenantName,
        dbName,
        subdomain,
        customDomain,
        adminSetup,
      );
    } catch (error) {
      this.logger.error(
        `❌ Tenant creation failed for "${tenantName}": ${error.message}`,
      );

      await this.rollbackTenantCreation(tenantName, dbName, tenantRecord);
      throw new InternalServerErrorException(
        `Tenant creation failed. All changes have been rolled back.`,
      );
    }
  }

  private async ensureUniqueTenant(
    name: string,
  ): Promise<{ subdomain: string }> {
    const baseSubdomain = toSubdomainSlug(name);
    let subdomain = baseSubdomain;
    let counter = 1;

    while (await this.tenantRepo.exists({ where: { subdomain } })) {
      subdomain = `${baseSubdomain}-${counter++}`;
    }

    if (await this.tenantRepo.exists({ where: { name } })) {
      throw new ConflictException(`Tenant "${name}" already exists`);
    }

    return { subdomain };
  }

  private async createDatabase(dbName: string) {
    await this.dataSource.query(`CREATE DATABASE "${dbName}"`);
    this.logger.log(`🗄️ Database created: ${dbName}`);
  }

  private async rollbackTenantCreation(
    tenantName: string,
    dbName: string,
    tenantRecord: Tenant | null,
  ) {
    try {
      if (dbName) {
        await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        this.logger.warn(`⚠️ Rolled back database: ${dbName}`);
      }

      if (tenantRecord) {
        await this.tenantRepo.delete({ id: tenantRecord.id });
        this.logger.warn(`⚠️ Rolled back tenant metadata: ${tenantName}`);
      }
    } catch (rollbackError) {
      this.logger.error(
        `❌ Rollback failed for tenant "${tenantName}": ${rollbackError.message}`,
      );
    }
  }

  private async bootstrapAdmin(
    connection: DataSource,
    subdomain: string,
  ): Promise<IAdminSetup> {
    const userRepo = connection.getRepository(User);
    const roleRepo = connection.getRepository(Role);
    const permissionRepo = connection.getRepository(Permission);

    const defaultPermissions = [
      'create-user',
      'edit-user',
      'view-user',
      'delete-user',
      'create-role',
      'edit-role',
      'view-role',
      'delete-role',
    ];

    const permissions = await Promise.all(
      defaultPermissions.map(async (permName) => {
        let perm = await permissionRepo.findOne({ where: { name: permName } });
        if (!perm) {
          perm = permissionRepo.create({ name: permName });
          await permissionRepo.save(perm);
        }
        return perm;
      }),
    );

    let adminRole = await roleRepo.findOne({
      where: { name: 'Admin' },
      relations: ['permissions'],
    });
    if (!adminRole) {
      adminRole = roleRepo.create({ name: 'Admin', permissions });
      await roleRepo.save(adminRole);
      this.logger.log(`🔑 Admin role created with default permissions`);
    }

    const adminEmail = `admin@${subdomain}.com`;
    const defaultPassword = 'Admin@123';
    const hashed = await argon2.hash(defaultPassword);

    const adminUser = userRepo.create({
      name: 'Administrator',
      email: adminEmail,
      password: hashed,
      role: adminRole,
    });
    await userRepo.save(adminUser);

    this.logger.log(`👤 Admin user created: ${adminEmail}`);

    return { role: adminRole, user: adminUser };
  }

  protected buildResponse(
    tenantName: string,
    dbName: string,
    subdomain: string,
    customDomain?: string,
    adminSetup?: IAdminSetup,
  ): ITenantResponse {
    if (!adminSetup) {
      throw new InternalServerErrorException('Admin setup missing.');
    }

    const { user, role } = adminSetup;

    return {
      success: true,
      message: `Tenant "${tenantName}" created successfully`,
      data: {
        tenantName,
        database: dbName,
        subdomain,
        customDomain: customDomain || null,
        //subdomainUrl: `https://${subdomain}.${process.env.BASE_DOMAIN}`,
        subdomainUrl: `https://${subdomain}.com`,
        customDomainUrl: customDomain ? `https://${customDomain}` : null,
        admin: {
          email: user.email,
          password: 'Admin@123',
          role: {
            id: role.id,
            name: role.name,
            permissions: role.permissions.map((p) => ({
              id: p.id,
              name: p.name,
            })),
          },
        },
      },
    };
  }

  async remove(id: number) {
    try {
      const tenant = await this.tenantRepo.findOneBy({ id });
      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${id} not found`);
      }

      const dbName = tenant.dbName;
      this.logger.log(
        `🧹 Preparing to delete tenant "${tenant.name}" and DB "${dbName}"`,
      );

      if (tenantConnections[dbName]) {
        const conn = tenantConnections[dbName];
        if (conn.isInitialized) {
          await conn.destroy();
          this.logger.log(`🔌 Closed active connection for ${dbName}`);
        }
        delete tenantConnections[dbName];
      }

      try {
        await this.dataSource.query(`
                    SELECT pg_terminate_backend(pid)
                    FROM pg_stat_activity
                    WHERE datname = '${dbName}'
                      AND pid <> pg_backend_pid();
                `);
        this.logger.log(`🔫 Terminated active sessions for ${dbName}`);
      } catch (terminateErr) {
        this.logger.warn(
          `⚠️ Could not terminate connections for ${dbName}: ${terminateErr.message}`,
        );
      }

      try {
        await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
        this.logger.log(`🗑️ Database dropped: ${dbName}`);
      } catch (dropErr) {
        this.logger.error(
          `❌ Failed to drop database ${dbName}:`,
          dropErr.stack,
        );
        throw new InternalServerErrorException(
          `Failed to drop database "${dbName}"`,
        );
      }

      await this.tenantRepo.remove(tenant);
      this.logger.log(`✅ Tenant record removed: ${tenant.name}`);

      return {
        success: true,
        message: `Tenant "${tenant.name}" and its database "${dbName}" deleted successfully.`,
        deleted: {
          id: tenant.id,
          name: tenant.name,
          dbName,
        },
      };
    } catch (error) {
      this.logger.error(
        `❌ Tenant deletion failed: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        `Failed to delete tenant: ${error.message}`,
      );
    }
  }

  async update(id: number, updates: Partial<Tenant>) {
    try {
      const tenant = await this.tenantRepo.findOneBy({ id });
      if (!tenant) {
        throw new NotFoundException(`Tenant with ID ${id} not found`);
      }

      // Prevent dangerous updates
      if (updates.dbName) delete updates.dbName;
      if (updates.id) delete updates.id;

      Object.assign(tenant, updates);
      await this.tenantRepo.save(tenant);

      return {
        success: true,
        message: `Tenant "${tenant.name}" updated successfully`,
        data: tenant,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to update tenant: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'An unexpected error occurred while updating tenant',
      );
    }
  }
}
