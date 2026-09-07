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
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from '../master/auth/entities';
import { Invoice, Plan, Subscription, WebsiteSignup } from '../master/billing/entities';
import {
    CreatePermissionsTable1701010001000,
    CreateRolesTable1701010000000,
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
    CreatePasswordResetTokensTable1701010015000,
    CreateEmailVerificationTokensTable1701010016000,
    CreateRefreshTokensTable1701010017000,
    AddCountryIdToCitiesTable1701010018000,
    CreateBillingTables1701010020000,
    AddModulesToPlansTable1701010021000,
    AddTenantProfileFields1701010022000,
    CreateWebsiteSignupsTable1701010023000,
    AddOneTimeLoginTokenToWebsiteSignups1701010024000,
    AddYearlyPricingToPlansTable1701010025000,
    AddModuleToPermissionsTable1701010026000,
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
            PasswordResetToken,
            EmailVerificationToken,
            RefreshToken,
            Plan,
            Subscription,
            Invoice,
            WebsiteSignup,
        ],
        migrations: [
                CreatePermissionsTable1701010001000,
                CreateRolesTable1701010000000,
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
                CreatePasswordResetTokensTable1701010015000,
                CreateEmailVerificationTokensTable1701010016000,
                CreateRefreshTokensTable1701010017000,
                AddCountryIdToCitiesTable1701010018000,
                CreateBillingTables1701010020000,
                AddModulesToPlansTable1701010021000,
                AddTenantProfileFields1701010022000,
                CreateWebsiteSignupsTable1701010023000,
                AddOneTimeLoginTokenToWebsiteSignups1701010024000,
                AddYearlyPricingToPlansTable1701010025000,
                AddModuleToPermissionsTable1701010026000,
        ],
    synchronize: false,
    // migrationsRun: true,
    logging,
    ssl: false,
    extra: {
     max: 10,
     connectionTimeoutMillis: 5000,
    },
};
