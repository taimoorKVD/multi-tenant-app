import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource} from "../datasource";
import {Logger} from './logger';

export class SeederRunner {
    constructor(private readonly seeders: ISeeder[]) {
    }

    async run() {
        try {
            await MasterDataSource.initialize();
            Logger.info('Connected to master database.');

            for (const seeder of this.seeders) {
                Logger.info(`Running: ${seeder.name}`);
                await seeder.run();
            }

            Logger.success('🌱 Master seeding completed successfully.');
        } catch (err) {
            Logger.error(`Seeding failed: ${err.message}`);
        } finally {
            await MasterDataSource.destroy();
        }
    }
}
