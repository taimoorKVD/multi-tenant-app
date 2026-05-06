import {DataSourceOptions} from 'typeorm';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';
import {Tenant} from '../master/tenants/entities';
import {JobPosition} from '../master/job-position/entities';
import {City} from '../master/cities/entities';
import {Country} from '../master/countries/entities';
import {State} from '../master/states/entities';
import {
    EmailLog,
    EmailTemplate,
    EmailTemplateRecipient,
    GlobalMailSetting,
} from '../master/mail/entities';
import { ActivityLog } from '../master/activity-logs/entities';
import {
  CreatePermissionsTable1701010000000,
  CreateRolesTable1701010001000,
  CreateUsersTable1701010002000,
  CreateJobPositionsTable1701010003000,
  CreateTenantsTable1701010004000,
  CreateCountriesTable1701010005000,
  CreateStatesTable1701010006000,
    CreateCitiesTable1701010006500,
    CreateEmailTemplatesTable1701010007000,
    CreateEmailTemplateRecipientsTable1701010008000,
    CreateGlobalMailSettingsTable1701010009000,
    CreateEmailLogsTable1701010010000,
    CreateActivityLogsTable1701010011000,
} from '../database/migrations';

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
        entities: [
            User,
            Role,
            Permission,
            Tenant,
            JobPosition,
            City,
            Country,
            State,
            EmailTemplate,
            EmailTemplateRecipient,
            GlobalMailSetting,
            EmailLog,
            ActivityLog,
        ],
    migrations: [
      CreatePermissionsTable1701010000000,
      CreateRolesTable1701010001000,
      CreateUsersTable1701010002000,
      CreateJobPositionsTable1701010003000,
      CreateTenantsTable1701010004000,
      CreateCountriesTable1701010005000,
      CreateStatesTable1701010006000,
    CreateCitiesTable1701010006500,
      CreateEmailTemplatesTable1701010007000,
      CreateEmailTemplateRecipientsTable1701010008000,
      CreateGlobalMailSettingsTable1701010009000,
      CreateEmailLogsTable1701010010000,
      CreateActivityLogsTable1701010011000,
    ],
    synchronize: false,
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
