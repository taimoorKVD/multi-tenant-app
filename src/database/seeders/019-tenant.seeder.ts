import { ISeeder } from '../interfaces/seeder.interface';
import { MasterDataSource, getTenantDataSource } from '../datasource';
import { Tenant } from '../../master/tenants/entities';
import { User } from '../../tenants/users/entities';
import { Role } from '../../tenants/role/entities';
import { Permission } from '../../tenants/permission/entities';
import {
  DynamicModule,
  Form,
  FormStatus,
} from '../../tenants/form-builder/entities';
import {
  FORM_BUILDER_MODULE_SEEDS,
  FormBuilderFieldSeed,
} from '../../tenants/form-builder/config/module-seeds';
import { toDbNameSlug, toSubdomainSlug } from '../../utils';
import { resolvePermissionModuleName } from '../../common/utils/permission-module';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';

const TENANT_NAME = 'brian';
const ADMIN_EMAIL = 'admin@brian.com';
const ADMIN_PASSWORD = 'admin123';
/** Local test-only field — never seed on the brian tenant. */
const EXCLUDED_DEFAULT_FIELD_KEYS = new Set(['image_upload']);

const DEFAULT_PERMISSIONS = [
  'create-user',
  'edit-user',
  'view-user',
  'delete-user',
  'create-role',
  'edit-role',
  'view-role',
  'delete-role',
  'create-job-position',
  'edit-job-position',
  'view-job-position',
  'delete-job-position',
  'create-location',
  'edit-location',
  'view-location',
  'delete-location',
  'create-vendor',
  'edit-vendor',
  'view-vendor',
  'delete-vendor',
  'create-reporting-group',
  'edit-reporting-group',
  'view-reporting-group',
  'delete-reporting-group',
  'create-item',
  'edit-item',
  'view-item',
  'delete-item',
  'create-permission',
  'edit-permission',
  'view-permission',
  'delete-permission',
  'create-dc-template',
  'view-dc-template',
  'edit-dc-template',
  'delete-dc-template',
  'activate-dc-template',
  'archive-dc-template',
  'view-dc-assignment',
  'complete-dc-assignment',
  'view-dc-submission',
  'review-dc-submission',
];

const EMPLOYEE_PERMISSION_NAMES = [
  'view-dc-assignment',
  'complete-dc-assignment',
  'view-dc-template',
  'view-item',
  'view-location',
  'view-job-position',
];

export class TenantSeeder implements ISeeder {
  name = 'TenantSeeder';

  async run() {
    const tenantRepo = MasterDataSource.getRepository(Tenant);
    const subdomain = toSubdomainSlug(TENANT_NAME);
    const dbName = toDbNameSlug(subdomain, 'tenant_');

    let tenant = await tenantRepo.findOne({
      where: [{ name: TENANT_NAME }, { subdomain }, { dbName }],
    });

    if (!tenant) {
      tenant = tenantRepo.create({
        name: TENANT_NAME,
        dbName,
        subdomain,
        email: ADMIN_EMAIL,
        status: 'active',
      });
      await tenantRepo.save(tenant);
      console.log(`✅ Created tenant metadata: ${TENANT_NAME} -> ${dbName}`);
    } else {
      let changed = false;
      if (tenant.email !== ADMIN_EMAIL) {
        tenant.email = ADMIN_EMAIL;
        changed = true;
      }
      if (tenant.name !== TENANT_NAME) {
        tenant.name = TENANT_NAME;
        changed = true;
      }
      if (changed) {
        await tenantRepo.save(tenant);
        console.log(`✅ Updated tenant metadata for "${TENANT_NAME}".`);
      } else {
        console.log(`ℹ️  Tenant "${TENANT_NAME}" already exists. Ensuring admin credentials...`);
      }
    }

    await this.ensureDatabase(dbName);

    const connection = await getTenantDataSource(dbName);
    await connection.synchronize();
    const actorId = await this.ensureAdmin(connection);
    await this.ensureFormBuilderDefaults(connection, actorId);

    console.log(
      `✅ Brian tenant ready — login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (subdomain: ${subdomain})`,
    );
  }

  private async ensureDatabase(dbName: string) {
    const existing = await MasterDataSource.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );

    if (existing.length) {
      console.log(`ℹ️  Database "${dbName}" already exists.`);
      return;
    }

    await MasterDataSource.query(`CREATE DATABASE "${dbName}"`);
    console.log(`🗄️ Database created: ${dbName}`);
  }

  private async ensureAdmin(connection: DataSource): Promise<number | null> {
    const userRepo = connection.getRepository(User);
    const roleRepo = connection.getRepository(Role);
    const permissionRepo = connection.getRepository(Permission);

    const permissions = await Promise.all(
      DEFAULT_PERMISSIONS.map(async (permName) => {
        let perm = await permissionRepo.findOne({ where: { name: permName } });
        if (!perm) {
          perm = permissionRepo.create({
            name: permName,
            module: resolvePermissionModuleName(permName),
          });
          await permissionRepo.save(perm);
        } else if (!perm.module) {
          perm.module = resolvePermissionModuleName(permName);
          await permissionRepo.save(perm);
        }
        return perm;
      }),
    );

    let adminRole = await roleRepo.findOne({
      where: { name: 'Admin' },
      relations: ['permissions'],
    });
    if (!adminRole) {
      adminRole = roleRepo.create({ name: 'Admin', permissions });
      await roleRepo.save(adminRole);
    } else {
      const existingNames = new Set((adminRole.permissions || []).map((p) => p.name));
      const merged = [...(adminRole.permissions || [])];
      for (const permission of permissions) {
        if (!existingNames.has(permission.name)) {
          merged.push(permission);
          existingNames.add(permission.name);
        }
      }
      adminRole.permissions = merged;
      await roleRepo.save(adminRole);
    }

    const employeePermissions = permissions.filter((p) =>
      EMPLOYEE_PERMISSION_NAMES.includes(p.name),
    );
    let employeeRole = await roleRepo.findOne({
      where: { name: 'Employee' },
      relations: ['permissions'],
    });
    if (!employeeRole) {
      employeeRole = roleRepo.create({ name: 'Employee', permissions: employeePermissions });
      await roleRepo.save(employeeRole);
    } else {
      const existingNames = new Set((employeeRole.permissions || []).map((p) => p.name));
      const merged = [...(employeeRole.permissions || [])];
      for (const permission of employeePermissions) {
        if (!existingNames.has(permission.name)) {
          merged.push(permission);
          existingNames.add(permission.name);
        }
      }
      employeeRole.permissions = merged;
      await roleRepo.save(employeeRole);
    }

    const hashed = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    let adminUser =
      (await userRepo.findOne({
        where: { isSystem: true },
        relations: ['role'],
        order: { id: 'ASC' },
      })) ||
      (await userRepo.findOne({
        where: { email: ADMIN_EMAIL },
        relations: ['role'],
      }));

    if (!adminUser) {
      adminUser = userRepo.create({
        name: TENANT_NAME,
        email: ADMIN_EMAIL,
        password: hashed,
        plainPassword: ADMIN_PASSWORD,
        role: adminRole,
        isSystem: true,
      });
      await userRepo.save(adminUser);
      console.log(`👤 Created brian admin user: ${ADMIN_EMAIL}`);
      return adminUser.id;
    }

    adminUser.name = TENANT_NAME;
    adminUser.email = ADMIN_EMAIL;
    adminUser.password = hashed;
    adminUser.plainPassword = ADMIN_PASSWORD;
    adminUser.role = adminRole;
    adminUser.isSystem = true;
    await userRepo.save(adminUser);
    console.log(`👤 Reset brian admin credentials to ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    return adminUser.id;
  }

  private filterDefaultFields(
    fields: readonly FormBuilderFieldSeed[] | undefined,
  ): FormBuilderFieldSeed[] {
    return (fields ?? []).filter((field) => !EXCLUDED_DEFAULT_FIELD_KEYS.has(field.key));
  }

  private mapDefaultFieldsToSchema(fields: FormBuilderFieldSeed[]) {
    return fields.map((item, index) => ({
      id: item.id,
      fieldKey: item.key,
      label: item.label,
      name: item.name,
      fieldTypeName: item.type,
      ...(item.type === 'image' ? { type: 'image' } : {}),
      placeholder: item.placeholder ?? 'Placeholder text',
      helpText: item.helpText ?? null,
      isRequired: item.isRequired ?? false,
      isEditable: item.isEditable ?? true,
      isUnique: item.isUnique ?? false,
      isReadonly: false,
      isSystemField: item.isSystemField ?? false,
      systemMappingKey: item.isSystemField ? (item.systemMappingKey ?? item.key) : null,
      isShow: item.isShow ?? true,
      ...(item.type === 'image'
        ? {
            referenceImages:
              item.referenceImages ??
              (item.referenceImage != null
                ? Array.isArray(item.referenceImage)
                  ? item.referenceImage
                  : [item.referenceImage]
                : item.defaultValue != null
                  ? Array.isArray(item.defaultValue)
                    ? item.defaultValue
                    : [item.defaultValue]
                  : []),
            multiple: item.multiple ?? false,
            minFiles: item.minFiles ?? null,
            maxFiles: item.maxFiles ?? (item.multiple ? 5 : 1),
          }
        : {}),
      ...(item.optionSource ? { optionSource: item.optionSource } : {}),
      sortOrder: index,
      ...(item.type === 'dropdown' || item.options?.length
        ? {
            options: (item.options ?? []).map((option, sortOrder) => ({
              label: option.label,
              value: option.value,
              isDefault: option.isDefault ?? false,
              sortOrder,
            })),
          }
        : {}),
    }));
  }

  private async ensureFormBuilderDefaults(
    connection: DataSource,
    actorId: number | null,
  ): Promise<void> {
    const moduleRepo = connection.getRepository(DynamicModule);
    const formRepo = connection.getRepository(Form);
    let formsSeeded = 0;
    let imageFieldsRemoved = 0;

    for (const moduleSeed of FORM_BUILDER_MODULE_SEEDS) {
      let moduleEntity = await moduleRepo.findOne({
        where: { slug: moduleSeed.slug },
        withDeleted: true,
      });

      if (!moduleEntity) {
        moduleEntity = moduleRepo.create({
          slug: moduleSeed.slug,
          name: moduleSeed.name,
          isActive: true,
          createdBy: actorId,
          updatedBy: actorId,
        });
      } else {
        moduleEntity.name = moduleSeed.name;
        moduleEntity.isActive = true;
        moduleEntity.deletedAt = null;
        moduleEntity.updatedBy = actorId;
      }

      moduleEntity = await moduleRepo.save(moduleEntity);

      let form = await formRepo.findOne({
        where: { moduleId: moduleEntity.id },
        withDeleted: true,
        order: { createdAt: 'DESC' },
      });

      if (!form) {
        form = formRepo.create({
          moduleId: moduleEntity.id,
          name: `${moduleSeed.name} Form`,
          status: FormStatus.DRAFT,
          autosaveSchema: null,
          createdBy: actorId,
          updatedBy: actorId,
        });
        form = await formRepo.save(form);
      } else if (form.deletedAt) {
        form.deletedAt = null;
        form.status = FormStatus.DRAFT;
        form.updatedBy = actorId;
        form = await formRepo.save(form);
      }

      const defaultFields = this.filterDefaultFields(moduleSeed.defaultFields);
      const existingFields = Array.isArray(form.autosaveSchema?.fields)
        ? form.autosaveSchema.fields
        : [];

      // Strip excluded local-test fields (e.g. Upload Images) on every run.
      if (existingFields.length) {
        const cleanedFields = existingFields.filter(
          (field: { fieldKey?: string; key?: string; name?: string }) => {
            const key = field.fieldKey || field.key || field.name;
            return !key || !EXCLUDED_DEFAULT_FIELD_KEYS.has(String(key));
          },
        );
        if (cleanedFields.length !== existingFields.length) {
          imageFieldsRemoved += existingFields.length - cleanedFields.length;
          form.autosaveSchema = {
            ...form.autosaveSchema,
            fields: cleanedFields.map((field: Record<string, unknown>, index: number) => ({
              ...field,
              sortOrder: index,
            })),
          };
          form.updatedBy = actorId;
          form = await formRepo.save(form);
        }
      }

      const fieldsAfterClean = Array.isArray(form.autosaveSchema?.fields)
        ? form.autosaveSchema.fields
        : [];

      if (!defaultFields.length) {
        continue;
      }

      // Seed defaults when the form has no fields yet (do not overwrite custom schemas).
      if (fieldsAfterClean.length) {
        continue;
      }

      form.autosaveSchema = {
        fields: this.mapDefaultFieldsToSchema(defaultFields),
      };
      form.updatedBy = actorId;
      await formRepo.save(form);
      formsSeeded += 1;
    }

    if (formsSeeded) {
      console.log(`🧩 Seeded default form fields for ${formsSeeded} module(s).`);
    }
    if (imageFieldsRemoved) {
      console.log(`🧹 Removed ${imageFieldsRemoved} upload-image field(s) from brian forms.`);
    }
    if (!formsSeeded && !imageFieldsRemoved) {
      console.log('ℹ️  Form-builder modules/default fields already present for brian.');
    }
  }
}
