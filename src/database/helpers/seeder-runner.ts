import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource} from "../datasource";

export class SeederRunner {
    constructor(private readonly seeders: ISeeder[]) {
    }

    async connect() {
        if (!MasterDataSource.isInitialized) {
            await MasterDataSource.initialize();
        }
    }

    async disconnect() {
        if (MasterDataSource.isInitialized) {
            await MasterDataSource.destroy();
        }
    }

    async truncateAll(): Promise<void> {
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ Truncate operation is disabled in production.');
            process.exit(1);
        }

        await this.connect();
        const ds = MasterDataSource;
        const entities = ds.entityMetadatas;

        console.log('⚠️  Truncating all tables...');
        for (const entity of entities) {
            const tableName = entity.tableName;
            await ds.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
            console.log(`🧹 Truncated: ${tableName}`);
        }

        console.log('✅ Database truncated successfully.');
    }

    async run(): Promise<void> {
        await this.connect();

        for (const seeder of this.seeders) {
            console.log(`🌱 Running: ${seeder.name}`);
            await seeder.run();
        }

        console.log('✅ Seeding completed.');
        await this.disconnect();
    }
}