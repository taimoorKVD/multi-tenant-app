import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException,} from '@nestjs/common';
import {DeepPartial, ObjectLiteral, Repository} from 'typeorm';

@Injectable()
export abstract class MasterAbstractService<T extends ObjectLiteral> {
    protected readonly paginateLimit = 15;

    protected constructor(protected readonly repository: Repository<T>) {
    }

    async paginate(page = 1, relations: string[] = []): Promise<any> {
        try {
            const take = this.paginateLimit;
            const [data, total] = await this.repository.findAndCount({
                take,
                skip: (page - 1) * take,
                relations,
            });
            const sanitized = data.map(({password, ...rest}) => rest);

            return {
                success: true,
                data: sanitized,
                meta: {
                    total,
                    page,
                    lastPage: Math.ceil(total / take),
                },
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to paginate records');
        }
    }

    async findAll(relations: string[] = []): Promise<any> {
        try {
            const data = await this.repository.find({relations});
            const sanitized = data.map(({password, ...rest}) => rest);

            return {
                success: true,
                count: sanitized.length,
                data: sanitized,
            }
        } catch (error) {
            throw new InternalServerErrorException('Failed to retrieve records');
        }
    }

    async create(data: DeepPartial<T>): Promise<any> {
        try {
            const mappedData: any = {...data};

            // automatically map *_id keys into relations
            for (const key of Object.keys(data)) {
                if (key.endsWith('_id')) {
                    const relationKey = key.replace('_id', '');
                    mappedData[relationKey] = {id: data[key]};
                    delete mappedData[key];
                }
            }

            const record = this.repository.create(mappedData);
            await this.repository.save(record);
            return {
                success: true,
                message: 'Record created successfully',
                data: record,
            };
        } catch (error) {
            throw new BadRequestException(`Failed to create record: ${error}`);
        }
    }

    async findOne(id: number, relations: string[] = []): Promise<any> {
        try {
            const record = await this.repository.findOne({
                where: {id} as any,
                relations,
            });
            if (!record) throw new NotFoundException('Record not found');
            delete (record as any).password;
            return {
                success: true,
                message: 'Record fetched successfully',
                data: record
            };
        } catch (error) {
            throw error;
        }
    }

    async update(id: number, data: DeepPartial<T>): Promise<any> {
        try {
            const record = await this.repository.findOneBy({ id } as any);
            if (!record) throw new NotFoundException('Record not found');

            await this.repository.update(id, data as any);
            const updated = await this.repository.findOneBy({ id } as any);

            return {
                success: true,
                message: 'Record updated successfully',
                data: updated,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to update record');
        }
    }

    async delete(id: number): Promise<any> {
        try {
            const record = await this.repository.findOneBy({id} as any);
            if (!record) throw new NotFoundException('Record not found');

            await this.repository.delete(id);
            return {
                success: true,
                message: 'Record deleted successfully',
                deletedId: id,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to delete record');
        }
    }
}
