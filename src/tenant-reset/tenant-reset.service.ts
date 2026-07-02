import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant } from 'src/master/tenants/entities';
import { TenantsService } from 'src/master/tenants/tenants.service';
import { Repository } from 'typeorm';


@Injectable()
export class TenantResetService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantService: TenantsService,
  ) {}

  async reset() {
    console.log('Resetting demo tenants...');

    const tenants = await this.tenantRepo.find();

    for (const tenant of tenants) {
      await this.tenantService.remove(tenant.id);
    }

    await this.tenantService.create({
      name: 'brain',
    } as any);

    await this.tenantService.create({
      name: 'kingdom-vision',
    } as any);

    console.log('Demo tenants reset successfully.');
  }
}