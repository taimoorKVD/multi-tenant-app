import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Tenant } from '../master/tenants/entities';
import { TenantsService } from '../master/tenants/tenants.service';

@Injectable()
export class TenantResetService {
    private executed = false;

  constructor(
    private readonly tenantsService: TenantsService,

    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async reset() {
    if (this.executed) {
      return;
    }

    this.executed = true;

    console.log('Running Tenant Reset...');

    const tenants = await this.tenantRepo.find();

    for (const tenant of tenants) {
      await this.tenantsService.remove(tenant.id);
    }

    await this.tenantsService.create({ name: 'brain' } as any);
    await this.tenantsService.create({ name: 'kingdom-vision' } as any);

    console.log('Tenant Reset Finished');
  }
}
