import 'dotenv/config';

import { SeederRunner } from '../helpers/seeder-runner';
import { PermissionSeeder, RoleSeeder, UserSeeder } from '../seeders';

(async () => {
  const runner = new SeederRunner([new PermissionSeeder(), new RoleSeeder(), new UserSeeder()]);

  const shouldReset = process.argv.includes('--reset') || process.argv.includes('reset');

  if (shouldReset) {
    console.log('⚙️  Reset mode enabled: truncating and reseeding...');
    await runner.truncateAll();
  }

  await runner.run();
})();
