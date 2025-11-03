import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Product } from './entities';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  /**
   * Utility to get the tenant's Product repository safely
   */
  protected getRepo(req: any): Repository<Product> {
    const tenantConnection: DataSource = req?.tenantConnection;
    if (!tenantConnection) {
      throw new BadRequestException(
        'Tenant connection not found. Ensure x-tenant-id header is provided.',
      );
    }
    return tenantConnection.getRepository(Product);
  }

  /**
   * Create a new product in tenant DB
   */
  async create(req: any, data: Partial<Product>) {
    try {
      const repo = this.getRepo(req);
      const product = repo.create(data);
      await repo.save(product);

      return {
        success: true,
        message: 'Product created successfully',
        tenant: req.tenantConnection.options.database,
        data: product,
      };
    } catch (error) {
      console.error('❌ Product creation failed:', error);
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  /**
   * Fetch all products for tenant
   */
  async findAll(req: any) {
    try {
      const repo = this.getRepo(req);
      const products = await repo.find({ order: { id: 'DESC' } });

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        count: products.length,
        data: products,
      };
    } catch (error) {
      console.error('❌ Failed to fetch products:', error);
      throw new InternalServerErrorException('Failed to retrieve products');
    }
  }

  /**
   * Get a single product by ID
   */
  async findOne(req: any, id: number) {
    try {
      const repo = this.getRepo(req);
      const product = await repo.findOneBy({ id });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      return {
        success: true,
        tenant: req.tenantConnection.options.database,
        data: product,
      };
    } catch (error) {
      console.error(`❌ Failed to find product [${id}]:`, error);
      throw error;
    }
  }

  /**
   * Update a product
   */
  async update(req: any, id: number, data: Partial<Product>) {
    try {
      const repo = this.getRepo(req);
      const product = await repo.findOneBy({ id });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      await repo.update(id, data);
      const updated = await repo.findOneBy({ id });

      return {
        success: true,
        message: 'Product updated successfully',
        tenant: req.tenantConnection.options.database,
        data: updated,
      };
    } catch (error) {
      console.error(`❌ Failed to update product [${id}]:`, error);
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  /**
   * Delete a product
   */
  async remove(req: any, id: number) {
    try {
      const repo = this.getRepo(req);
      const product = await repo.findOneBy({ id });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      await repo.delete(id);

      return {
        success: true,
        message: 'Product deleted successfully',
        tenant: req.tenantConnection.options.database,
        deletedId: id,
      };
    } catch (error) {
      console.error(`❌ Failed to delete product [${id}]:`, error);
      throw new InternalServerErrorException('Failed to delete product');
    }
  }
}
