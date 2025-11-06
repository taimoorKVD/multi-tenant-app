import { DataSourceOptions } from 'typeorm';
import { User } from '../master/users/entities';
import { Role } from '../master/role/entities';
import { Permission } from '../master/permission/entities';
import { Tenant } from '../master/tenants/entities';

export const masterDatabaseConfig = (): DataSourceOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, Role, Permission, Tenant],
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',

    // ✅ Only enable SSL in production
    ssl: isProduction ? { rejectUnauthorized: false } : false,

    // ❌ Remove `extra.ssl` entirely unless needed
    ...(isProduction
      ? {
          extra: {
            ssl: { rejectUnauthorized: false },
          },
        }
      : {}),
  };
};
