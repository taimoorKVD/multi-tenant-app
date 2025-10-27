import 'dotenv/config';

import {SeederRunner} from '../helpers/seeder-runner';
import {PermissionSeeder, RoleSeeder, UserSeeder} from '../seeders';

async function runMasterSeed() {
    const runner = new SeederRunner([
        new PermissionSeeder(),
        new RoleSeeder(),
        new UserSeeder(),
    ]);

    await runner.run();
}

runMasterSeed();
