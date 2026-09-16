import { DataSource } from 'typeorm';
import { DynamicModule, EntityDynamicData, Form, FormVersion } from '../../tenants/form-builder/entities';
import { User } from '../../tenants/users/entities';

type FormFieldLike = {
  id?: string;
  fieldKey?: string;
  key?: string;
  name?: string;
  systemMappingKey?: string;
};

export async function resolveTenantActorId(tenantDataSource: DataSource): Promise<number | null> {
  const userRepo = tenantDataSource.getRepository(User);

  const systemUser = await userRepo.findOne({
    where: { isSystem: true },
    order: { id: 'ASC' },
    select: { id: true },
  });
  if (systemUser?.id) return systemUser.id;

  const adminUser = await userRepo
    .createQueryBuilder('user')
    .innerJoin('user.role', 'role')
    .where('role.name = :roleName', { roleName: 'Admin' })
    .orderBy('user.id', 'ASC')
    .select(['user.id'])
    .getOne();
  if (adminUser?.id) return adminUser.id;

  const firstUser = await userRepo.findOne({
    order: { id: 'ASC' },
    select: { id: true },
  });
  return firstUser?.id ?? null;
}

export async function resolveModuleFormContext(
  tenantDataSource: DataSource,
  slug: string,
): Promise<{ moduleId: number; formVersionId: number | null; fields: FormFieldLike[] } | null> {
  const moduleRepo = tenantDataSource.getRepository(DynamicModule);
  const formRepo = tenantDataSource.getRepository(Form);
  const versionRepo = tenantDataSource.getRepository(FormVersion);

  const moduleEntity = await moduleRepo.findOne({ where: { slug } });
  if (!moduleEntity) return null;

  const form = await formRepo.findOne({
    where: { moduleId: moduleEntity.id },
    order: { createdAt: 'DESC' },
  });
  if (!form) return null;

  const activeVersion = await versionRepo.findOne({
    where: { formId: form.id, isActive: true },
  });

  const fields = Array.isArray(form.autosaveSchema?.fields)
    ? (form.autosaveSchema.fields as FormFieldLike[])
    : Array.isArray(activeVersion?.schemaSnapshot?.fields)
      ? (activeVersion.schemaSnapshot.fields as FormFieldLike[])
      : [];

  return {
    moduleId: moduleEntity.id,
    formVersionId: activeVersion?.id ?? null,
    fields,
  };
}

/** Maps canonical field keys onto published/autosave field ids when available. */
export function mapDynamicPayloadToFieldIds(
  fields: FormFieldLike[],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const keyToFieldId = new Map<string, string>();

  for (const field of fields) {
    const fieldId = String(field.id || '').trim();
    if (!fieldId) continue;

    for (const candidate of [field.fieldKey, field.key, field.name, field.systemMappingKey]) {
      const key = String(candidate || '').trim();
      if (key && !keyToFieldId.has(key)) keyToFieldId.set(key, fieldId);
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[keyToFieldId.get(key) || key] = value;
  }
  return result;
}

export async function upsertEntityDynamicData(
  tenantDataSource: DataSource,
  params: {
    moduleId: number;
    entityId: number;
    formVersionId: number | null;
    data: Record<string, unknown>;
    actorId: number | null;
  },
): Promise<void> {
  const dynamicRepo = tenantDataSource.getRepository(EntityDynamicData);
  let row = await dynamicRepo.findOne({
    where: { moduleId: params.moduleId, entityId: params.entityId },
  });

  if (!row) {
    row = dynamicRepo.create({
      moduleId: params.moduleId,
      entityId: params.entityId,
      formVersionId: params.formVersionId,
      data: params.data,
      createdBy: params.actorId,
      updatedBy: params.actorId,
    });
  } else {
    row.formVersionId = params.formVersionId;
    row.data = params.data;
    row.updatedBy = params.actorId;
  }

  await dynamicRepo.save(row);
}
