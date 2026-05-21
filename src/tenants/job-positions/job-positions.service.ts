import {BadRequestException, Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import {DataSource, In} from 'typeorm';
import {JobPosition} from './entities';
import {TenantAbstractService} from '../../common/abstract';
import {Permission} from '../permission/entities';
import {CreateJobPositionDto, UpdateJobPositionDto} from './dto';

@Injectable()
export class JobPositionsService extends TenantAbstractService<JobPosition> {
    constructor(private readonly dataSource: DataSource) {
        super(dataSource.getRepository(JobPosition));
    }

    private async resolvePermissions(req: any, permissionIds: number[] = []): Promise<Permission[]> {
        if (!permissionIds.length) return [];

        const repo = this.getRepo(req).manager.getRepository(Permission);
        const permissions = await repo.find({where: {id: In(permissionIds)}});

        if (permissions.length !== permissionIds.length) {
            throw new BadRequestException('One or more permission IDs are invalid.');
        }

        return permissions;
    }

    async create(req: any, data: CreateJobPositionDto): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const existing = await repo.findOne({where: {name: data.name} as any});
            if (existing) {
                throw new BadRequestException('A job position with this name already exists.');
            }

            const permissions = await this.resolvePermissions(req, data.permissionIds || []);
            const entity = repo.create({
                name: data.name,
                description: data.description ?? null,
                permissions,
            });

            const saved = await repo.save(entity);
            const hydrated = await repo.findOne({
                where: {id: saved.id} as any,
                relations: ['permissions'],
            });

            return {
                success: true,
                message: 'Record created successfully',
                tenant: req.tenantConnection.options.database,
                data: hydrated,
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            console.error('Create job position failed:', error);
            throw new InternalServerErrorException('Failed to create record');
        }
    }

    async findAll(req: any): Promise<any> {
        return super.findAll(req, ['permissions']);
    }

    async findOne(req: any, id: number): Promise<any> {
        return super.findOne(req, id, ['permissions']);
    }

    async update(req: any, id: number, data: UpdateJobPositionDto): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const entity = await repo.findOne({
                where: {id} as any,
                relations: ['permissions'],
            });

            if (!entity) {
                throw new NotFoundException(`Record with ID ${id} not found`);
            }

            if (data.name && data.name !== entity.name) {
                const duplicate = await repo.findOne({where: {name: data.name} as any});
                if (duplicate && duplicate.id !== id) {
                    throw new BadRequestException('A job position with this name already exists.');
                }
                entity.name = data.name;
            }

            if (data.description !== undefined) {
                entity.description = data.description ?? null;
            }

            if (data.permissionIds !== undefined) {
                entity.permissions = await this.resolvePermissions(req, data.permissionIds);
            }

            const saved = await repo.save(entity);
            const hydrated = await repo.findOne({
                where: {id: saved.id} as any,
                relations: ['permissions'],
            });

            return {
                success: true,
                message: 'Record updated successfully',
                tenant: req.tenantConnection.options.database,
                data: hydrated,
            };
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
            console.error('Update job position failed:', error);
            throw new InternalServerErrorException('Failed to update record');
        }
    }

    async search(
        req: any,
        limit = 15,
        filters?: {
            name?: string;
            description?: string;
            permissionId?: number;
        },
    ): Promise<any> {
        try {
            const repo = this.getRepo(req);
            const parsedLimit = Number(limit);
            const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
            const name = filters?.name?.trim();
            const description = filters?.description?.trim();
            const permissionId = filters?.permissionId;
            const hasFilters = Boolean(name || description || permissionId);

            if (!hasFilters) {
                return {
                    success: true,
                    tenant: req.tenantConnection.options.database,
                    count: 0,
                    data: [],
                };
            }

            const qb = repo
                .createQueryBuilder('jobPosition')
                .leftJoinAndSelect('jobPosition.permissions', 'permission');

            if (name) {
                qb.andWhere('jobPosition.name ILIKE :name', {name: `%${name}%`});
            }

            if (description) {
                qb.andWhere('jobPosition.description ILIKE :description', {
                    description: `%${description}%`,
                });
            }

            if (permissionId) {
                qb.andWhere('permission.id = :permissionId', {permissionId});
            }

            const data = await qb.orderBy('jobPosition.id', 'DESC').take(take).getMany();

            return {
                success: true,
                tenant: req.tenantConnection.options.database,
                count: data.length,
                data,
            };
        } catch (error) {
            console.error('Tenant job position search failed:', error);
            throw new InternalServerErrorException('Failed to search job positions');
        }
    }
}
