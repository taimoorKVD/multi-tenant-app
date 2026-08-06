import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataCollectionTemplate, TemplateVersion, TemplateStatus } from '../entities';
import { CreateTemplateDto, UpdateTemplateDto, QueryTemplateDto } from '../dto';
import { AssignmentsService } from './assignments.service';
import { WorkflowActionsService } from './workflow-actions.service';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly workflowActions: WorkflowActionsService,
  ) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private async createVersion(
    versionRepo: any,
    templateId: number,
    schema: Record<string, any>,
    actorId: number | null,
    isActive: boolean,
  ) {
    const latestVersion = await versionRepo.findOne({
      where: { templateId },
      order: { versionNumber: 'DESC' },
    });
    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    if (isActive && latestVersion?.isActive) {
      latestVersion.isActive = false;
      latestVersion.updatedBy = actorId;
      await versionRepo.save(latestVersion);
    }

    const version = versionRepo.create({
      templateId,
      versionNumber: nextVersionNumber,
      schemaSnapshot: schema,
      isActive,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return versionRepo.save(version);
  }

  private async publishInternal(
    req: any,
    template: DataCollectionTemplate,
    actorId: number | null,
  ) {
    if (!template.schema) {
      throw new BadRequestException('Cannot publish a template without a schema');
    }

    const schema = template.schema as Record<string, any>;
    if (!schema.assign || (!(schema.assign.users?.length) && !(schema.assign.jobPosition?.length))) {
      throw new BadRequestException(
        'Assign step requires at least one user or job position before publishing',
      );
    }
    if (!schema.frequency?.date && !schema.frequency?.startDate) {
      throw new BadRequestException('Frequency step requires a date before publishing');
    }

    const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
    const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

    const version = await this.createVersion(versionRepo, template.id, schema, actorId, true);

    template.status = TemplateStatus.ACTIVE;
    template.isActive = true;
    template.updatedBy = actorId;
    const saved = await templateRepo.save(template);

    await this.assignmentsService.cancelFutureForTemplate(req, template.id, version.id);
    const assignments = await this.assignmentsService.materializeFromTemplate(
      req,
      saved,
      version,
      actorId,
    );

    const emailNotify = await this.workflowActions.notifyAssigneesOnPublish(req, {
      templateId: saved.id,
      templateName: saved.name,
      assignments,
    });

    return { template: saved, version, assignments, emailNotify };
  }

  async create(req: any, dto: CreateTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const actorId = this.getActorId(req, dto.createdBy);

      const template = templateRepo.create({
        name: dto.name,
        schema: (dto.schema as Record<string, any>) ?? null,
        status: TemplateStatus.DRAFT,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      });

      const saved = await templateRepo.save(template);

      // Always publish on create (version + assignments + assignee emails).
      const published = await this.publishInternal(req, saved, actorId);
      return {
        success: true,
        message: 'Template created and published successfully',
        data: published.template,
        version: published.version,
        assignmentsCreated: published.assignments.length,
        emailNotify: published.emailNotify,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
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

      if (template.status === TemplateStatus.ARCHIVED && dto.publish) {
        throw new BadRequestException('Archived templates cannot be published; restore or create a new draft');
      }

      const actorId = this.getActorId(req, dto.updatedBy);
      if (dto.name !== undefined) template.name = dto.name;
      if (dto.schema !== undefined) template.schema = dto.schema as Record<string, any>;
      if (dto.isActive !== undefined) template.isActive = dto.isActive;
      template.updatedBy = actorId;

      // Editing an active template moves it back to draft until re-published (unless publish flag set).
      if (dto.schema !== undefined && template.status === TemplateStatus.ACTIVE && dto.publish !== true) {
        template.status = TemplateStatus.DRAFT;
      }

      let saved = await templateRepo.save(template);

      if (dto.publish === true) {
        const published = await this.publishInternal(req, saved, actorId);
        return {
          success: true,
          message: 'Template updated and published successfully',
          data: published.template,
          version: published.version,
          assignmentsCreated: published.assignments.length,
          emailNotify: published.emailNotify,
        };
      }

      return { success: true, message: 'Template updated successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to update template');
    }
  }

  async publish(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      if (template.status === TemplateStatus.ARCHIVED) {
        throw new BadRequestException('Cannot publish an archived template');
      }

      const actorId = this.getActorId(req);
      const published = await this.publishInternal(req, template, actorId);

      return {
        success: true,
        message: 'Template published successfully',
        data: published.template,
        version: published.version,
        assignmentsCreated: published.assignments.length,
        emailNotify: published.emailNotify,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      console.error('Template publish failed:', error);
      throw new InternalServerErrorException('Failed to publish template');
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

      // Prefer publish for full materialization; activate only re-enables an existing published template.
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
      const activeVersion = await versionRepo.findOne({
        where: { templateId: id, isActive: true },
      });
      if (!activeVersion) {
        throw new BadRequestException('No published version found. Use publish instead of activate.');
      }

      template.status = TemplateStatus.ACTIVE;
      template.isActive = true;
      template.updatedBy = this.getActorId(req);

      const saved = await templateRepo.save(template);
      return { success: true, message: 'Template activated successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
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
      await this.assignmentsService.cancelFutureForTemplate(req, id);

      return { success: true, message: 'Template archived successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to archive template');
    }
  }

  async search(req: any, limit?: number, filters?: Record<string, any>) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const parsedLimit = Number(limit);
      const take = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;

      const rawFilters = Object.entries(filters || {}).reduce((acc, [key, value]) => {
        const normalizedKey = String(key || '').trim();
        if (!normalizedKey || normalizedKey === 'limit') return acc;
        const normalizedValue =
          typeof value === 'string' ? value.trim() : value === undefined || value === null ? '' : String(value);
        if (!normalizedValue) return acc;
        acc[normalizedKey] = normalizedValue;
        return acc;
      }, {} as Record<string, string>);

      if (!Object.keys(rawFilters).length) {
        return { success: true, count: 0, data: [] };
      }

      const qb = templateRepo.createQueryBuilder('template');

      for (const [key, value] of Object.entries(rawFilters)) {
        if (key === 'name') {
          qb.andWhere('template.name ILIKE :name', { name: `%${value}%` });
        } else if (key === 'status') {
          qb.andWhere('template.status = :status', { status: value });
        }
      }

      const data = await qb.orderBy('template.id', 'DESC').take(take).getMany();
      return { success: true, count: data.length, data };
    } catch (error) {
      console.error('Template search failed:', error);
      throw new InternalServerErrorException('Failed to search templates');
    }
  }
}
