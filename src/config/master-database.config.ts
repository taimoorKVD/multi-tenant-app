import {DataSourceOptions} from 'typeorm';
import {User} from '../master/users/entities';
import {Role} from '../master/role/entities';
import {Permission} from '../master/permission/entities';
import {Tenant} from '../master/tenants/entities';
import {JobPosition} from "../master/job-position/entities";

export const masterDatabaseConfig = (): DataSourceOptions => {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: [User, Role, Permission, Tenant, JobPosition],
        synchronize: false,
        logging: process.env.DB_LOGGING === 'true',
        ssl: isProduction ? {rejectUnauthorized: false} : false,
        ...(isProduction
            ? {
                extra: {
                    ssl: {rejectUnauthorized: false},
                },
            }
            : {}),
    };
};
