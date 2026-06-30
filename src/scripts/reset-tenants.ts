import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Tenant } from '../master/tenants/entities';
import { Repository } from 'typeorm';
import { TenantsService } from '../master/tenants/tenants.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const tenantService = app.get(TenantsService);

    const tenantRepository = app.get<Repository<Tenant>>(
      getRepositoryToken(Tenant),
    );

    const tenants = await tenantRepository.find();

    console.log(`Found ${tenants.length} tenant(s).`);

    // Delete existing tenants
    for (const tenant of tenants) {
      console.log(`Deleting: ${tenant.name}`);
      await tenantService.remove(tenant.id);
    }

    // Create default tenants
    const defaultTenants = ['brain', 'kingdom-vision', 'taimoor'];

    for (const name of defaultTenants) {
      console.log(`Creating: ${name}`);

      await tenantService.create({
        name,
      } as any);
    }

    console.log('✅ Tenant reset completed successfully.');
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();