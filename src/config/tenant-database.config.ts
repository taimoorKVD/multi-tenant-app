import {DataSourceOptions} from 'typeorm';
import {User} from '../tenants/users/entities';
import {Role} from '../tenants/role/entities';
import {Permission} from '../tenants/permission/entities';
import {Product} from '../tenants/products/entities';
import {JobPosition} from '../tenants/job-positions/entities';
import {Location} from '../tenants/locations/entities';
import {Vendor} from '../tenants/vendors/entities';
import {ReportingGroup} from '../tenants/reporting-groups/entities';
import {ReportingCategory} from '../tenants/reporting-categories/entities';
import {Item} from '../tenants/items/entities';
import {
  TenantEmailTemplate,
  TenantMailSetting,
} from '../tenants/mail/entities';
import {
  EmailVerificationToken,
  PasswordResetToken,
  RefreshToken,
} from '../tenants/auth/entities';
import {
  DynamicModule,
  EntityDynamicData,
  Form,
  FormAuditLog,
  FormVersion,
} from '../tenants/form-builder/entities';
import {
  DataCollectionTemplate,
  TemplateVersion,
  DataCollectionAssignment,
  DataCollectionSubmission,
  DataCollectionSubmissionFlag,
  DataCollectionSubmissionReviewEvent,
} from '../tenants/data-collection/entities';

export const tenantDatabaseConfig = (dbName: string): DataSourceOptions => {
  const env = process.env.NODE_ENV?.toLowerCase() || 'development';

  const requiredVars = [
    'TENANT_DB_HOST',
    'TENANT_DB_USER',
    'TENANT_DB_PASS',
  ];

  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      throw new Error(`❌ Missing required environment variable: ${variable}`);
    }
  }

  const host = process.env.TENANT_DB_HOST!;
  const port = Number(process.env.TENANT_DB_PORT || 5432);
  const username = process.env.TENANT_DB_USER!;
  const password = process.env.TENANT_DB_PASS!;

  const logging = process.env.DB_LOGGING === 'true';

  console.info(
    `📦 Tenant DB: ${host}:${port}/${dbName} | ENV=${env.toUpperCase()} | SSL=DISABLED`,
  );

  return {
    type: 'postgres',
    host,
    port,
    username,
    password,
    database: dbName,

    entities: [
      User,
      Product,
      Role,
      Permission,
      JobPosition,
      Location,
      Vendor,
      ReportingGroup,
      ReportingCategory,
      Item,
      TenantMailSetting,
      TenantEmailTemplate,
      PasswordResetToken,
      EmailVerificationToken,
      RefreshToken,
      DynamicModule,
      Form,
      FormVersion,
      FormAuditLog,
      EntityDynamicData,
      DataCollectionTemplate,
      TemplateVersion,
      DataCollectionAssignment,
      DataCollectionSubmission,
      DataCollectionSubmissionFlag,
      DataCollectionSubmissionReviewEvent,
    ],

    synchronize: true,
    logging,

    ssl: false,

    extra: {
      max: 10,
      connectionTimeoutMillis: 5000,
    },
  };
};
