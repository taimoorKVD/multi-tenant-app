import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { DataCollectionTemplate, TemplateStatus, TemplateVersion } from '../entities';
import { QueryTemplateVersionDto } from '../dto';

@Injectable()
export class TemplateVersionsService {
  async findAll(req: any, templateId: number, query: QueryTemplateVersionDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);

      const template = await templateRepo.findOne({ where: { id: templateId } });
      if (!template) throw new NotFoundException(`Template with ID ${templateId} not found`);

      const page = Math.max(1, query.page ?? 1);
      const limit = Math.min(Math.max(1, query.limit ?? 15), 100);
      const skip = (page - 1) * limit;

      const qb = versionRepo
        .createQueryBuilder('version')
        .where('version.templateId = :templateId', { templateId })
        .orderBy('version.versionNumber', 'DESC')
        .skip(skip)
        .take(limit);

      const [data, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;

      return { success: true, meta: { total, page, lastPage }, data };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Template versions findAll failed:', error);
      throw new InternalServerErrorException('Failed to retrieve template versions');
    }
  }

  async findOne(req: any, templateId: number, versionId: number) {
    try {
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);

      const version = await versionRepo.findOne({
        where: { id: versionId, templateId },
      });
      if (!version) throw new NotFoundException(`Template version with ID ${versionId} not found`);
      return { success: true, data: version };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve template version');
    }
  }

  async findActive(req: any, templateId: number) {
    try {
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);

      const version = await versionRepo.findOne({
        where: { templateId, isActive: true },
        order: { versionNumber: 'DESC' },
      });
      if (!version) throw new NotFoundException(`No active version found for template ${templateId}`);
      return { success: true, data: version };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve active template version');
    }
  }

  private actor(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) return null;
    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  async restore(req: any, templateId: number, versionNumber: number) {
    try {
      await req.tenantConnection.manager.transaction(async (manager) => {
        const templateRepo = manager.getRepository(DataCollectionTemplate);
        const versionRepo = manager.getRepository(TemplateVersion);

        const template = await templateRepo.findOne({ where: { id: templateId } });
        if (!template) throw new NotFoundException(`Template with ID ${templateId} not found`);

        const targetVersion = await versionRepo.findOne({
          where: { templateId, versionNumber },
        });
        if (!targetVersion) throw new NotFoundException(`Template version ${versionNumber} not found`);

        const actor = this.actor(req);

        template.schema = targetVersion.schemaSnapshot || {};
        template.status = TemplateStatus.DRAFT;
        template.updatedBy = actor;
        await templateRepo.save(template);

        await versionRepo.update(
          { templateId, isActive: true },
          { isActive: false, updatedBy: actor },
        );

        targetVersion.isActive = true;
        targetVersion.updatedBy = actor;
        await versionRepo.save(targetVersion);
      });

      return { success: true, message: 'Template version restored successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Template version restore failed:', error);
      throw new InternalServerErrorException('Failed to restore template version');
    }
  }
}
