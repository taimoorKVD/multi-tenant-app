import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException,} from '@nestjs/common';
import {DeepPartial, Repository} from 'typeorm';

interface PaginatedMeta {
  total: number;
  page: number;
  lastPage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T | T[];
  count?: number;
  meta?: PaginatedMeta;
}

@Injectable()
export abstract class MasterAbstractService<T extends Record<string, any>> {
  protected readonly paginateLimit = 15;

  protected constructor(protected readonly repository: Repository<T>) {}

  async paginate(
    page = 1,
    relations: string[] = [],
    limit?: number,
  ): Promise<ApiResponse<Partial<T>>> {
    try {
      const parsedLimit = Number(limit);
      const take =
        limit === undefined
          ? this.paginateLimit
          : parsedLimit <= 0
            ? undefined
            : Math.min(Math.max(parsedLimit, 1), 100);
      const [data, total] = await this.repository.findAndCount({
        ...(take ? {take, skip: (page - 1) * take} : {}),
        relations,
        order: {id: 'DESC'} as any,
      });

      const sanitized = data.map((item) => {
        const clone = { ...item };

        if ('password' in clone) {
          delete clone.password;
        }

        return clone;
      });

      return {
        success: true,
        data: sanitized,
        meta: { total, page, lastPage: take ? Math.ceil(total / take) : 1 },
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to paginate records');
    }
  }

  async findAll(relations: string[] = []): Promise<ApiResponse<Partial<T>>> {
    try {
      const data = await this.repository.find({
        relations,
        order: {id: 'DESC'} as any,
      });
      const sanitized = data.map((item) => {
        const clone = { ...item };
        delete (clone as any).password;
        return clone;
      });

      return { success: true, count: sanitized.length, data: sanitized };
    } catch {
      throw new InternalServerErrorException('Failed to retrieve records');
    }
  }

  async create(data: DeepPartial<T>): Promise<ApiResponse<T>> {
    try {
      const mappedData: any = { ...data };

      // Auto-map foreign key IDs (like role_id → role: {id})
      for (const key of Object.keys(data)) {
        if (key.endsWith('_id')) {
          const relationKey = key.replace('_id', '');
          mappedData[relationKey] = { id: (data as any)[key] };
          delete mappedData[key];
        }
      }

      const record = this.repository.create(mappedData);
      const saved = await this.repository.save(record);

      return { success: true, message: 'Record created successfully', data: saved };
    } catch (error: any) {
      throw new BadRequestException(`Failed to create record: ${error.message}`);
    }
  }

  async findOne(id: number, relations: string[] = []): Promise<ApiResponse<Partial<T>>> {
    const record = await this.repository.findOne({
      where: { id } as any,
      relations,
    });
    if (!record) throw new NotFoundException('Record not found');

    const clone = { ...record };
    delete (clone as any).password;

    return { success: true, message: 'Record fetched successfully', data: clone };
  }

  async update(id: number, data: DeepPartial<T>): Promise<ApiResponse<T>> {
    try {
      const record = await this.repository.findOneBy({ id } as any);
      if (!record) throw new NotFoundException('Record not found');

      // ✅ Modern TypeORM automatically handles DeepPartial<T>
      await this.repository.update(id, data as any);

      const updated = await this.repository.findOneBy({ id } as any);
      if (!updated) throw new NotFoundException('Failed to fetch updated record');

      return { success: true, message: 'Record updated successfully', data: updated };
    } catch (error: any) {
      throw new InternalServerErrorException(`Failed to update record: ${error.message}`);
    }
  }

  async delete(id: number): Promise<ApiResponse<null>> {
    try {
      const record = await this.repository.findOneBy({id} as any);
      if (!record) throw new NotFoundException('Record not found');

      await this.repository.delete(id);
      return {success: true, message: 'Record deleted successfully'};
    } catch (error: any) {
      if (
          error instanceof BadRequestException ||
          error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
          'An unexpected error occurred while deleting the record. Please try again later.',
      );
    }

  }
}
