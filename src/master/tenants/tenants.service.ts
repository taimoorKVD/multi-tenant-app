import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {getTenantDataSource, tenantConnections, toDbNameSlug, toSubdomainSlug, withUniqueSuffix} from '../../utils';
import {Tenant} from './entities';

@Injectable()
export class TenantsService {
    private readonly logger = new Logger(TenantsService.name);

    constructor(
        @InjectRepository(Tenant)
        private tenantRepo: Repository<Tenant>,
        private dataSource: DataSource
    ) {
    }

    async findAll() {
        try {
            const tenants = await this.tenantRepo.find({
                order: {id: 'DESC'},
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

    async create(name: string, customDomain?: string) {
        const raw = name?.trim();

        try {
            if (!raw) {
                throw new BadRequestException('Tenant name is required');
            }

            const baseSubdomain = toSubdomainSlug(raw);
            let subdomain = baseSubdomain;
            let counter = 1;
            while (await this.tenantRepo.exists({where: {subdomain}})) {
                counter++;
                subdomain = `${baseSubdomain}-${counter}`;
            }

            let baseDbName = toDbNameSlug(raw, 'tenant_');
            let dbName = baseDbName;
            let i = 1;
            while (await this.tenantRepo.exists({where: {dbName}})) {
                i += 1;
                dbName = withUniqueSuffix(baseDbName, i);
            }

            if (await this.tenantRepo.exists({where: {name: raw}})) {
                throw new ConflictException(`Tenant "${raw}" already exists`);
            }

            const tenant = this.tenantRepo.create({
                name: raw,
                dbName,
                subdomain,
                customDomain: customDomain || null,
            });
            await this.tenantRepo.save(tenant);
            this.logger.log(`🟢 Tenant metadata saved: ${raw} -> db=${dbName}`);

            // 6) Create DB + sync schema
            await this.dataSource.query(`CREATE DATABASE "${dbName}"`);
            this.logger.log(`🗄️ Database created: ${dbName}`);

            const tenantConnection = await getTenantDataSource(dbName);
            await tenantConnection.synchronize();
            this.logger.log(`✅ Tenant DB synchronised: ${dbName}`);

            // 7) Response
            return {
                success: true,
                message: `Tenant "${raw}" created successfully`,
                data: {
                    tenantName: raw,
                    database: dbName,
                    subdomain,
                    customDomain,
                    subdomainUrl: `https://${subdomain}.${process.env.BASE_DOMAIN}`,
                    customDomainUrl: customDomain ? `https://${customDomain}` : null,
                },
            };
        } catch (error) {
            this.logger.error(`❌ Failed to create tenant "${raw}": ${error.message}`, error.stack);

            // Optional cleanup: drop partially created DB if the failure happened after DB creation.
            // (You can detect by checking error context and attempting DROP DATABASE here.)

            if (error instanceof BadRequestException || error instanceof ConflictException) {
                throw error;
            }
            throw new InternalServerErrorException(
                `An unexpected error occurred while creating tenant "${raw}".`,
            );
        }
    }

    async remove(id: number) {
        try {
            const tenant = await this.tenantRepo.findOneBy({id});
            if (!tenant) {
                throw new NotFoundException(`Tenant with ID ${id} not found`);
            }

            const dbName = tenant.dbName;
            this.logger.log(`🧹 Preparing to delete tenant "${tenant.name}" and DB "${dbName}"`);

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
                this.logger.warn(`⚠️ Could not terminate connections for ${dbName}: ${terminateErr.message}`);
            }

            try {
                await this.dataSource.query(`DROP DATABASE IF EXISTS "${dbName}"`);
                this.logger.log(`🗑️ Database dropped: ${dbName}`);
            } catch (dropErr) {
                this.logger.error(`❌ Failed to drop database ${dbName}:`, dropErr.stack);
                throw new InternalServerErrorException(`Failed to drop database "${dbName}"`);
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
            this.logger.error(`❌ Tenant deletion failed: ${error.message}`, error.stack);

            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(
                `Failed to delete tenant: ${error.message}`,
            );
        }
    }

    async update(id: number, updates: Partial<Tenant>) {
        try {
            const tenant = await this.tenantRepo.findOneBy({id});
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
            this.logger.error(`❌ Failed to update tenant: ${error.message}`, error.stack);

            if (error instanceof NotFoundException) throw error;
            throw new InternalServerErrorException(
                'An unexpected error occurred while updating tenant',
            );
        }
    }
}
