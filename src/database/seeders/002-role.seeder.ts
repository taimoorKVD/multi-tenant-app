// src/database/seeders/master/002-roles.seeder.ts
import {ISeeder} from '../interfaces/seeder.interface';
import {MasterDataSource} from '../datasource';
import {Role} from '../../master/role/entities';
import {Permission} from '../../master/permission/entities';

export class RoleSeeder implements ISeeder {
    name = 'RoleSeeder';

    async run() {
        const roleRepo = MasterDataSource.getRepository(Role);
        const permRepo = MasterDataSource.getRepository(Permission);

        if (await roleRepo.count()) return;

        const permissions = await permRepo.find();

        const roles = [
            {name: 'Super Admin', permissions},
            {
                name: 'Admin',
                permissions: permissions.filter(p =>
                    ['view-role', 'view-user', 'view-tenant', 'view-permission'].includes(p.name),
                ),
            },
        ];

        await roleRepo.save(roles);
    }
}
