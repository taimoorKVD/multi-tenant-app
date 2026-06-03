import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateFieldTypeDto } from '../dto';
import { FieldType } from '../entities';

@Injectable()
export class FieldTypesService {
  constructor(private readonly dataSource: DataSource) {}

  private getActorId(req: any, fallback?: number | null): number | null {
    const candidate = fallback ?? req.user?.id ?? req.user?.sub ?? req.user?.userId ?? null;
    if (candidate === null || candidate === undefined) {
      return null;
    }

    const actorId = Number(candidate);
    return Number.isFinite(actorId) ? actorId : null;
  }

  private readonly defaultFieldTypes = [
    { name: 'name_fields', rendererType: 'input', componentName: 'name-fields', icon: 'badge', category: 'General Fields', supportsOptions: false },
    { name: 'text', rendererType: 'input', componentName: 'simple-text', icon: 'text_fields', category: 'General Fields', supportsOptions: false },
    { name: 'textarea', rendererType: 'textarea', componentName: 'text-area', icon: 'notes', category: 'General Fields', supportsOptions: false },
    { name: 'number', rendererType: 'input', componentName: 'numeric-field', icon: 'pin', category: 'General Fields', supportsOptions: false },
    { name: 'dropdown', rendererType: 'select', componentName: 'dropdown-field', icon: 'arrow_drop_down_circle', category: 'General Fields', supportsOptions: true },
    { name: 'multiple_choice', rendererType: 'choice', componentName: 'multiple-choice', icon: 'check_box', category: 'General Fields', supportsOptions: true },
    { name: 'checkbox', rendererType: 'checkbox', componentName: 'checkbox-field', icon: 'check_box_outline_blank', category: 'General Fields', supportsOptions: true },
    { name: 'radio', rendererType: 'radio', componentName: 'radio-field', icon: 'radio_button_checked', category: 'General Fields', supportsOptions: true },
    { name: 'email', rendererType: 'input', componentName: 'email-address', icon: 'mail', category: 'General Fields', supportsOptions: false },
    { name: 'phone', rendererType: 'input', componentName: 'phone-mobile-field', icon: 'phone', category: 'General Fields', supportsOptions: false },
    { name: 'time_date', rendererType: 'datetime', componentName: 'time-date', icon: 'schedule', category: 'General Fields', supportsOptions: false },
    { name: 'file_upload', rendererType: 'file', componentName: 'file-upload', icon: 'upload_file', category: 'Advanced Fields', supportsOptions: false },
    { name: 'image_upload', rendererType: 'file', componentName: 'image-upload', icon: 'image', category: 'Advanced Fields', supportsOptions: false },
    { name: 'password', rendererType: 'input', componentName: 'password-field', icon: 'password', category: 'General Fields', supportsOptions: false },
    { name: 'website_url', rendererType: 'input', componentName: 'website-url', icon: 'link', category: 'General Fields', supportsOptions: false },
    { name: 'mask_input', rendererType: 'input', componentName: 'mask-input', icon: 'dialpad', category: 'General Fields', supportsOptions: false },
    { name: 'address_fields', rendererType: 'address', componentName: 'address-fields', icon: 'location_on', category: 'General Fields', supportsOptions: false },
    { name: 'country_list', rendererType: 'select', componentName: 'country-list', icon: 'public', category: 'General Fields', supportsOptions: true },
    { name: 'custom_html', rendererType: 'html', componentName: 'custom-html', icon: 'code', category: 'Advanced Fields', supportsOptions: false },
  ];

  async ensureSeeded(req: any): Promise<void> {
    const repo = req.tenantConnection.getRepository(FieldType);
    const existing = await repo.find({
      select: ['name'],
    });
    const existingNames = new Set(existing.map((item) => item.name));

    const actor = this.getActorId(req);
    const rows = this.defaultFieldTypes
      .filter((item) => !existingNames.has(item.name))
      .map((item) =>
        repo.create({
          name: item.name,
          rendererType: item.rendererType,
          componentName: item.componentName,
          icon: item.icon,
          category: item.category,
          configSchema: {},
          supportsOptions: item.supportsOptions,
          supportsValidation: true,
          supportsConditions: true,
          isActive: true,
          createdBy: actor,
          updatedBy: actor,
        }),
      );

    if (!rows.length) {
      return;
    }

    await repo.save(rows);
  }

  async findAll(req: any) {
    await this.ensureSeeded(req);
    const repo = req.tenantConnection.getRepository(FieldType);
    const data = await repo.find({ order: { category: 'ASC', name: 'ASC' } });
    return { success: true, tenant: req.tenantConnection.options.database, count: data.length, data };
  }

  async create(req: any, dto: CreateFieldTypeDto) {
    const repo = req.tenantConnection.getRepository(FieldType);
    const exists = await repo.findOne({ where: { name: dto.name.trim() } });
    if (exists) throw new BadRequestException(`Field type ${dto.name} already exists.`);

    const entity = repo.create({
      name: dto.name.trim(),
      rendererType: dto.rendererType,
      componentName: dto.componentName,
      configSchema: dto.configSchema || {},
      icon: dto.icon || null,
      category: dto.category || 'General Fields',
      supportsOptions: dto.supportsOptions || false,
      supportsValidation: dto.supportsValidation ?? true,
      supportsConditions: dto.supportsConditions ?? true,
      isActive: dto.isActive ?? true,
      createdBy: this.getActorId(req, dto.createdBy ?? null),
      updatedBy: this.getActorId(req, dto.createdBy ?? null),
    });

    const data = await repo.save(entity);
    return { success: true, message: 'Field type created successfully', data };
  }
}
