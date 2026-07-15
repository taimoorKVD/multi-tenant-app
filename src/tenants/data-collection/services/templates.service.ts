import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataCollectionTemplate, TemplateStatus } from '../entities';
import { CreateTemplateDto, UpdateTemplateDto, QueryTemplateDto } from '../dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly dataSource: DataSource) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  async create(req: any, dto: CreateTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

      const actorId = this.getActorId(req, dto.createdBy);

      const template = templateRepo.create({
        name: dto.name,
        schema: dto.schema ?? null,
        status: TemplateStatus.DRAFT,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      });

      const saved = await templateRepo.save(template);
      return { success: true, message: 'Template created successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Template creation failed:', error);
      throw new InternalServerErrorException('Failed to create template');
    }
  }

  async findAll(req: any, query: QueryTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;

      const qb = templateRepo.createQueryBuilder('template');

      if (query.status) {
        qb.andWhere('template.status = :status', { status: query.status });
      }
      if (query.search) {
        qb.andWhere('template.name ILIKE :search', {
          search: `%${query.search}%`,
        });
      }

      qb.orderBy('template.createdAt', 'DESC').skip(skip).take(limit);
      const [data, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;

      return { success: true, meta: { total, page, lastPage }, data };
    } catch (error) {
      console.error('Template findAll failed:', error);
      throw new InternalServerErrorException('Failed to retrieve templates');
    }
  }

  async findOne(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({
        where: { id },
      });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);
      return { success: true, data: template };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve template');
    }
  }

  async update(req: any, id: number, dto: UpdateTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      const actorId = this.getActorId(req, dto.updatedBy);
      if (dto.name !== undefined) template.name = dto.name;
      if (dto.schema !== undefined) template.schema = dto.schema;
      if (dto.isActive !== undefined) template.isActive = dto.isActive;
      template.updatedBy = actorId;

      const saved = await templateRepo.save(template);
      return { success: true, message: 'Template updated successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to update template');
    }
  }

  async remove(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);
      await templateRepo.softRemove(template);
      return { success: true, message: 'Template deleted successfully', data: null };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete template');
    }
  }

  async activate(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      template.status = TemplateStatus.ACTIVE;
      template.isActive = true;
      template.updatedBy = this.getActorId(req);

      const saved = await templateRepo.save(template);
      return { success: true, message: 'Template activated successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to activate template');
    }
  }

  async archive(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      template.status = TemplateStatus.ARCHIVED;
      template.updatedBy = this.getActorId(req);

      const saved = await templateRepo.save(template);
      return { success: true, message: 'Template archived successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to archive template');
    }
  }

}
