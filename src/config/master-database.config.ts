import {DataSourceOptions} from 'typeorm';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';
import {Tenant} from '../master/tenants/entities';
import {JobPosition} from '../master/job-position/entities';

const env = process.env.NODE_ENV?.toLowerCase() || 'development';
const isProduction = env === 'production';

const requiredVars = ['DATABASE_URL'];
for (const variable of requiredVars) {
    if (isProduction && !process.env[variable]) {
        throw new Error(`❌ Missing required environment variable: ${variable}`);
    }
}

const databaseUrl = process.env.DATABASE_URL || '';
const logging = process.env.DB_LOGGING === 'true';

console.info(
    `🏗️ Master DB connection initialised | ENV=${env.toUpperCase()} | SSL=${isProduction ? 'ENABLED' : 'DISABLED'}`,
);

export const masterDatabaseConfig: DataSourceOptions = {
    type: 'postgres',
    url: databaseUrl,
    entities: [User, Role, Permission, Tenant, JobPosition],
    synchronize: false,
    // migrations: [__dirname + '/../database/migrations/[0-9]*.{ts,js}'],
    // migrationsRun: true,
    logging,
    ssl: isProduction ? {rejectUnauthorized: false} : false,
    extra: isProduction
        ? {
            ssl: {rejectUnauthorized: false},
            max: 10,
            connectionTimeoutMillis: 5000,
        }
        : {},
};
