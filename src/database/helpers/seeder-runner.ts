import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';

export class SeederRunner {
  constructor(private readonly seeders: ISeeder[]) {}

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

  /**
   * 💣 Forcefully drop and recreate all database tables
   * - Works safely in local/dev environments
   * - Rebuilds schema using entity metadata
   */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Full database reset is disabled in production.');
      process.exit(1);
    }

    await this.connect();
    const ds = MasterDataSource;

    console.log('💣 Dropping all tables and resetting schema...');

    try {
      // Drop and recreate the entire public schema
      await ds.query(`DROP SCHEMA public CASCADE;`);
      await ds.query(`CREATE SCHEMA public;`);
      await ds.query(`GRANT ALL ON SCHEMA public TO postgres;`);
      await ds.query(`GRANT ALL ON SCHEMA public TO public;`);

      console.log('🧹 All tables dropped and schema recreated successfully.');
    } catch (error) {
      console.error('❌ Failed to drop schema:', error.message);
    }

    // Recreate tables automatically from entities
    try {
      await ds.synchronize();
      console.log('🏗️  Tables recreated successfully using entity metadata.');
    } catch (error) {
      console.error(
        '⚠️ Failed to synchronize tables automatically:',
        error.message,
      );
    }
  }

  /**
   * 🌱 Run all registered seeders sequentially
   */
  async run(): Promise<void> {
    await this.connect();

    for (const seeder of this.seeders) {
      console.log(`🌱 Running: ${seeder.name}`);
      try {
        await seeder.run();
        console.log(`✅ Completed: ${seeder.name}`);
      } catch (error) {
        console.error(`❌ Failed: ${seeder.name} → ${error.message}`);
      }
    }

    console.log('🎉 All seeders executed successfully.');
    await this.disconnect();
  }
}
