import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource } from '../datasource';
import { User } from '../../master/users/entities';
import { Role } from '../../master/role/entities';
import * as argon2 from 'argon2';

export class UserSeeder implements ISeeder {
  name = 'UserSeeder';

  async run() {
    const userRepo = MasterDataSource.getRepository(User);
    const roleRepo = MasterDataSource.getRepository(Role);

    if (await userRepo.count()) return;

    const superAdminRole = await roleRepo.findOneBy({ name: 'Super Admin' });
    const adminRole = await roleRepo.findOneBy({ name: 'Admin' });

    if (!superAdminRole || !adminRole) {
      throw new Error('❌ Required roles not found. Run RoleSeeder first.');
    }

    const users: Partial<User>[] = [
      {
        name: 'Super Admin',
        email: 'superadmin@system.com',
        password: await argon2.hash('SuperSecure123!', {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 3,
          parallelism: 1,
        }),
        role: superAdminRole,
      },
      {
        name: 'Admin User',
        email: 'admin@system.com',
        password: await argon2.hash('AdminSecure123!', {
          type: argon2.argon2id,
          memoryCost: 2 ** 16,
          timeCost: 3,
          parallelism: 1,
        }),
        role: adminRole,
      },
    ];

    await userRepo.save(users as User[]); // ✅ cast safe after null-check
    console.log('✅ Seeded Super Admin and Admin users.');
  }
}
