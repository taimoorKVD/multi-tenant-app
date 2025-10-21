import {DataSource} from 'typeorm';
import {Tenant} from '../master/tenants/entities';

export const MasterDataSource = new DataSource({
    type: 'postgres',
    host: process.env.MASTER_DB_HOST,
    port: Number(process.env.MASTER_DB_PORT || 5432),
    username: process.env.MASTER_DB_USER,
    password: process.env.MASTER_DB_PASS,
    database: process.env.MASTER_DB_NAME,
    entities: [Tenant],
    synchronize: true,
});

// Initialize on app start (optional safeguard)
MasterDataSource.initialize()
    .then(() => console.log('✅ Master DB connected'))
    .catch(err => console.error('❌ Master DB connection error:', err));
