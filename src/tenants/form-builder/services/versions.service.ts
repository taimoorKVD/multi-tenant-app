import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  Form,
  FormStatus,
  FormVersion,
} from '../entities';

@Injectable()
export class VersionsService {
  constructor(private readonly dataSource: DataSource) {}

  private actor(req: any, fallback?: number): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  async findAll(req: any, formId: number) {
    const repo = req.tenantConnection.getRepository(FormVersion);
    const data = await repo.find({
      where: { formId },
      order: { versionNumber: 'DESC' },
    });
    return { success: true, count: data.length, data };
  }

  async findOne(req: any, formId: number, version: number) {
    const repo = req.tenantConnection.getRepository(FormVersion);
    const data = await repo.findOne({
      where: { formId, versionNumber: version },
    });
    if (!data) throw new NotFoundException('Version not found');

    return { success: true, data };
  }

  async restore(req: any, formId: number, version: number, updatedBy?: number) {
    await req.tenantConnection.manager.transaction(async (manager) => {
      const formRepo = manager.getRepository(Form);
      const versionRepo = manager.getRepository(FormVersion);

      const form = await formRepo.findOne({ where: { id: formId } });
      if (!form) throw new NotFoundException('Form not found');

      const targetVersion = await versionRepo.findOne({
        where: { formId, versionNumber: version },
      });
      if (!targetVersion) throw new NotFoundException('Target version not found');

      const actor = this.actor(req, updatedBy);

      form.autosaveSchema = targetVersion.schemaSnapshot || {};

      form.status = FormStatus.DRAFT;
      form.updatedBy = actor;
      await formRepo.save(form);

      await versionRepo.update(
        { formId, isActive: true },
        { isActive: false, updatedBy: actor },
      );
      targetVersion.isActive = true;
      targetVersion.updatedBy = actor;
      await versionRepo.save(targetVersion);
    });

    return { success: true, message: 'Form version restored successfully' };
  }
}
