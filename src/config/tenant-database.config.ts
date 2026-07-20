import {DataSourceOptions} from 'typeorm';
import {User} from '../tenants/users/entities';
import {Role} from '../tenants/role/entities';
import {Permission} from '../tenants/permission/entities';
import {Product} from '../tenants/products/entities';
import {JobPosition} from "../tenants/job-positions/entities";
import {Location} from "../tenants/locations/entities";
import {Vendor} from '../tenants/vendors/entities';
import { ReportingGroup } from '../tenants/reporting-groups/entities';
import { ReportingCategory } from '../tenants/reporting-categories/entities';
import { Item } from '../tenants/items/entities';
import { TenantEmailTemplate, TenantMailSetting } from '../tenants/mail/entities';
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
} from '../tenants/data-collection/entities';

export const tenantDatabaseConfig = (dbName: string): DataSourceOptions => {
  const env = process.env.NODE_ENV?.toLowerCase() || 'development';
  const isProduction = env === 'production';

  const requiredVars = [
    isProduction ? 'TENANT_DB_HOST_NEON' : 'TENANT_DB_HOST',
    isProduction ? 'TENANT_DB_USER_NEON' : 'TENANT_DB_USER',
    isProduction ? 'TENANT_DB_PASS_NEON' : 'TENANT_DB_PASS',
  ];
  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      throw new Error(`❌ Missing required environment variable: ${variable}`);
    }
  }

  const host = isProduction
    ? process.env.TENANT_DB_HOST_NEON!
    : process.env.TENANT_DB_HOST || 'localhost';

  const port = Number(
    isProduction ? process.env.TENANT_DB_PORT_NEON || 5432 : process.env.TENANT_DB_PORT || 5432,
  );

  const username = isProduction
    ? process.env.TENANT_DB_USER_NEON!
    : process.env.TENANT_DB_USER || 'postgres';

  const password = isProduction
    ? process.env.TENANT_DB_PASS_NEON!
    : process.env.TENANT_DB_PASS || '';

  const logging = process.env.DB_LOGGING === 'true';

  console.info(
    `📦 Tenant DB: ${host}:${port} | ENV=${env.toUpperCase()} | SSL=${
      isProduction ? 'ENABLED' : 'DISABLED'
    }`,
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
    ],
    synchronize: true,
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
};
