import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { DataCollectionTemplate, TemplateVersion, TemplateStatus } from '../entities';
import { CreateTemplateDto, UpdateTemplateDto, QueryTemplateDto } from '../dto';
import { AssignmentsService } from './assignments.service';
import { WorkflowActionsService } from './workflow-actions.service';
import { FrequencyService } from './frequency.service';
import { parseExclusiveAssignReportTargets, resolveAssignReportMode } from '../utils/assignment-completion.util';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly assignmentsService: AssignmentsService,
    private readonly workflowActions: WorkflowActionsService,
    private readonly frequencyService: FrequencyService,
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

  /** YYYY-MM-DD in UTC — used when Recurring UI omits the Date field. */
  private todayUtcDateOnly(): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private isRecurringFrequency(type: unknown): boolean {
    return String(type || '').toLowerCase() === 'recurring';
  }

  /**
   * Stable JSON for schedule comparisons (key order / null vs [] must not count as a change).
   */
  private canonicalizeJson(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      const mapped = value.map((item) => this.canonicalizeJson(item));
      if (mapped.every((item) => typeof item === 'number')) {
        return [...(mapped as number[])].sort((a, b) => a - b);
      }
      if (mapped.every((item) => typeof item === 'string')) {
        return [...(mapped as string[])].sort((a, b) => a.localeCompare(b));
      }
      return mapped;
    }
    if (typeof value === 'object') {
      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
        const child = input[key];
        if (child === undefined) continue;
        output[key] = this.canonicalizeJson(child);
      }
      return output;
    }
    return value;
  }

  private normalizeFrequencyType(type: unknown): string {
    const value = String(type || '').toLowerCase().trim();
    if (
      value === 'atonce' ||
      value === 'at_once' ||
      value === 'at-once' ||
      value === 'one_time' ||
      value === 'one-time' ||
      value === 'onetime'
    ) {
      return 'atonce';
    }
    if (value === 'recurring') return 'recurring';
    return value;
  }

  private frequencyHasDate(frequency: Record<string, unknown>): boolean {
    const raw = frequency.date ?? frequency.startDate;
    return raw !== null && raw !== undefined && String(raw).trim() !== '';
  }

  /** Who must complete the form — ignores null/[] and mode vs assignmentType aliases. */
  private canonicalizeAssign(assign: unknown): string {
    const parsed = parseExclusiveAssignReportTargets(
      assign as { users?: unknown; jobPosition?: unknown } | null,
    );
    const mode = resolveAssignReportMode(
      assign as { mode?: unknown; assignmentType?: unknown } | null,
    );
    return JSON.stringify({
      mode,
      users: [...parsed.users].sort((a, b) => a - b),
      jobPosition: [...parsed.jobPosition].sort((a, b) => a - b),
    });
  }

  /**
   * Semantic frequency equality:
   * - UI vs canonical recurring shapes (every/interval vs interval/unit)
   * - flat UI root fields vs nested `recurring`
   * - date vs startDate, endDate, time / times
   * - omitted recurring date inherits previous anchor (Frequency card has no date field)
   */
  private frequenciesEquivalent(previous: unknown, next: unknown): boolean {
    if (previous == null && next == null) return true;
    if (previous == null || next == null) return false;
    if (typeof previous !== 'object' || typeof next !== 'object') return false;

    const prev = previous as Record<string, unknown>;
    const nxt: Record<string, unknown> = { ...(next as Record<string, unknown>) };

    if (this.normalizeFrequencyType(prev.type) !== this.normalizeFrequencyType(nxt.type)) {
      return false;
    }

    // Recurring UI often omits date on save — keep the previously published anchor.
    if (!this.frequencyHasDate(nxt) && this.frequencyHasDate(prev)) {
      nxt.date = prev.date ?? prev.startDate;
      if (nxt.startDate == null || nxt.startDate === '') {
        nxt.startDate = prev.startDate ?? prev.date;
      }
    }

    const prevDate = String(prev.date ?? prev.startDate ?? '').trim();
    const nextDate = String(nxt.date ?? nxt.startDate ?? '').trim();
    if (prevDate !== nextDate) return false;

    const prevEnd = String(prev.endDate ?? '').trim();
    const nextEnd = String(nxt.endDate ?? '').trim();
    if (prevEnd !== nextEnd) return false;

    if (
      this.canonicalizeOccurrenceTimes(prev) !== this.canonicalizeOccurrenceTimes(nxt)
    ) {
      return false;
    }

    if (this.normalizeFrequencyType(prev.type) === 'atonce') {
      return true;
    }

    const prevSchedule = this.frequencyService.resolveScheduleRaw(prev as any);
    const nextSchedule = this.frequencyService.resolveScheduleRaw(nxt as any);

    if (!prevSchedule && !nextSchedule) return true;
    if (!prevSchedule || !nextSchedule) return false;

    const prevNormalized = this.frequencyService.normalizeSchedule(prevSchedule);
    const nextNormalized = this.frequencyService.normalizeSchedule(nextSchedule);
    return (
      JSON.stringify(this.canonicalizeJson(prevNormalized)) ===
      JSON.stringify(this.canonicalizeJson(nextNormalized))
    );
  }

  /** Stable fingerprint for time / times so rematerialize runs when clock slots change. */
  private canonicalizeOccurrenceTimes(frequency: Record<string, unknown>): string {
    const times = this.frequencyService.resolveOccurrenceTimes(frequency as any);
    return JSON.stringify(
      times.map((t) => `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`),
    );
  }

  /** Assign / frequency changes require rematerializing employee assignments (report does not). */
  private scheduleAffectingSchemaChanged(
    previous: Record<string, any> | null | undefined,
    next: Record<string, any> | null | undefined,
  ): boolean {
    if (!next || typeof next !== 'object') return false;

    // Partial payloads must not look like "cleared assign/frequency".
    const previousAssign = previous?.assign;
    const nextAssign = Object.prototype.hasOwnProperty.call(next, 'assign')
      ? next.assign
      : previousAssign;
    const previousFrequency = previous?.frequency;
    const nextFrequency = Object.prototype.hasOwnProperty.call(next, 'frequency')
      ? next.frequency
      : previousFrequency;

    return (
      this.canonicalizeAssign(previousAssign) !== this.canonicalizeAssign(nextAssign) ||
      !this.frequenciesEquivalent(previousFrequency, nextFrequency)
    );
  }

  /**
   * Validate assign + frequency for publish.
   * Recurring Frequency UI has no date picker — default `date` to today when missing.
   * Mutates schema.frequency in place so the stored snapshot keeps a concrete start date.
   */
  private ensurePublishableSchema(schema: Record<string, any>) {
    const assign = parseExclusiveAssignReportTargets(schema.assign);
    if (assign.hasUsers && assign.hasJobPositions) {
      throw new BadRequestException(
        'Choose either Users or Job Positions for Assign — not both.',
      );
    }
    if (!assign.hasUsers && !assign.hasJobPositions) {
      throw new BadRequestException(
        'Assign step requires at least one user or job position before publishing',
      );
    }

    if (schema.report) {
      const report = parseExclusiveAssignReportTargets(schema.report);
      if (report.hasUsers && report.hasJobPositions) {
        throw new BadRequestException(
          'Choose either Users or Job Positions for Report To — not both.',
        );
      }
    }

    if (!schema.frequency || typeof schema.frequency !== 'object') {
      throw new BadRequestException('Frequency step is required before publishing');
    }

    const frequency = schema.frequency as Record<string, any>;
    const rawDate = frequency.date ?? frequency.startDate;
    const hasDate = rawDate !== null && rawDate !== undefined && String(rawDate).trim() !== '';

    if (!hasDate) {
      if (this.isRecurringFrequency(frequency.type)) {
        frequency.date = this.todayUtcDateOnly();
      } else {
        throw new BadRequestException('Frequency step requires a date before publishing');
      }
    }
  }

  /**
   * Publish creates a new active version always.
   * Cancel + rematerialize only when assign/frequency changed (who/when).
   * Form/report-only publishes keep existing open tasks and retarget them to the new version.
   */
  private async publishInternal(
    req: any,
    template: DataCollectionTemplate,
    actorId: number | null,
    options?: { rematerializeAssignments?: boolean },
  ) {
    if (!template.schema) {
      throw new BadRequestException('Cannot publish a template without a schema');
    }

    const schema = template.schema as Record<string, any>;
    const rematerializeAssignments = options?.rematerializeAssignments !== false;

    const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
    const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

    // Preserve the previously published recurring anchor date when the UI omits it.
    // Otherwise ensurePublishableSchema would rewrite it to "today" and look like a schedule change.
    const previousActive = await versionRepo.findOne({
      where: { templateId: template.id, isActive: true },
    });
    const frequency = schema.frequency as Record<string, any> | undefined;
    if (frequency && typeof frequency === 'object' && this.isRecurringFrequency(frequency.type)) {
      const rawDate = frequency.date ?? frequency.startDate;
      const hasDate = rawDate !== null && rawDate !== undefined && String(rawDate).trim() !== '';
      if (!hasDate) {
        const prevFrequency = (previousActive?.schemaSnapshot as Record<string, any> | null)?.frequency;
        const prevDate = prevFrequency?.date ?? prevFrequency?.startDate;
        if (prevDate !== null && prevDate !== undefined && String(prevDate).trim() !== '') {
          frequency.date = prevDate;
          if (frequency.startDate == null || String(frequency.startDate).trim() === '') {
            frequency.startDate = prevDate;
          }
        }
      }
    }

    this.ensurePublishableSchema(schema);

    const version = await this.createVersion(versionRepo, template.id, schema, actorId, true);

    template.status = TemplateStatus.ACTIVE;
    template.isActive = true;
    template.updatedBy = actorId;
    const saved = await templateRepo.save(template);

    let assignments: Awaited<
      ReturnType<AssignmentsService['materializeFromTemplate']>
    > = [];
    let emailNotify = { sent: 0, failed: 0, skipped: 0 };

    if (rematerializeAssignments) {
      await this.assignmentsService.cancelFutureForTemplate(req, template.id, version.id);
      assignments = await this.assignmentsService.materializeFromTemplate(
        req,
        saved,
        version,
        actorId,
      );
      emailNotify = await this.workflowActions.notifyAssigneesOnPublish(req, {
        templateId: saved.id,
        templateName: saved.name,
        assignments,
      });
    } else {
      await this.assignmentsService.retargetOpenAssignmentsToVersion(
        req,
        template.id,
        version.id,
        actorId,
      );
    }

    return { template: saved, version, assignments, emailNotify };
  }

  async create(req: any, dto: CreateTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const actorId = this.getActorId(req, dto.createdBy);

      const schema = (dto.schema as Record<string, any>) ?? null;
      if (!schema) {
        throw new BadRequestException('Cannot publish a template without a schema');
      }
      // Validate (and default recurring date) before insert so failed publishes leave no orphan draft.
      this.ensurePublishableSchema(schema);

      const template = templateRepo.create({
        name: dto.name,
        schema,
        status: TemplateStatus.DRAFT,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      });

      const saved = await templateRepo.save(template);

      // Always publish + rematerialize on create (first assignments + assignee emails).
      const published = await this.publishInternal(req, saved, actorId, {
        rematerializeAssignments: true,
      });
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

      if (query.status) {
        qb.andWhere('template.status = :status', { status: query.status });
      } else {
        // Default list hides archived so deleted forms stay in the archive view.
        qb.andWhere('template.status != :archived', { archived: TemplateStatus.ARCHIVED });
      }

      qb.orderBy('template.createdAt', 'DESC').skip(skip).take(limit);
      const [rows, total] = await qb.getManyAndCount();
      const lastPage = Math.ceil(total / limit) || 1;
      const data = rows.map((row) => this.serializeTemplate(row));

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
      return { success: true, data: this.serializeTemplate(template) };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to retrieve template');
    }
  }

  /**
   * Response-only: attach AM/PM helpers on frequency so edit forms can bind
   * Hour/Minute/Period from stored 24h `time` / `times` (e.g. `"22:33"` → 10:33 PM).
   * Does not mutate the persisted jsonb row.
   */
  private serializeTemplate(template: DataCollectionTemplate): DataCollectionTemplate {
    const schema = template.schema;
    if (!schema || typeof schema !== 'object' || !schema.frequency) {
      return template;
    }

    return {
      ...template,
      schema: {
        ...schema,
        frequency: this.frequencyService.enrichFrequencyForUi(schema.frequency as any),
      },
    };
  }

  async update(req: any, id: number, dto: UpdateTemplateDto) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      const previousSchema = (template.schema || null) as Record<string, any> | null;
      const scheduleChanged =
        dto.schema !== undefined &&
        this.scheduleAffectingSchemaChanged(previousSchema, dto.schema as Record<string, any>);

      // Match create: assign/frequency edits re-publish unless explicitly opted out with publish:false.
      const shouldPublish =
        dto.publish === true || (dto.publish !== false && scheduleChanged);

      if (template.status === TemplateStatus.ARCHIVED && shouldPublish) {
        throw new BadRequestException('Archived templates cannot be published; restore or create a new draft');
      }

      const actorId = this.getActorId(req, dto.updatedBy);
      if (dto.name !== undefined) template.name = dto.name;
      if (dto.schema !== undefined) template.schema = dto.schema as Record<string, any>;
      if (dto.isActive !== undefined) template.isActive = dto.isActive;
      template.updatedBy = actorId;

      // Never demote ACTIVE → DRAFT on update. Form/name edits stay live; assign/frequency
      // changes still publish via shouldPublish below.

      const saved = await templateRepo.save(template);

      if (shouldPublish) {
        // Rematerialize only when assign/frequency actually changed vs the live published version.
        // First publish (no active version yet) always rematerializes.
        const previousActive = await req.tenantConnection
          .getRepository(TemplateVersion)
          .findOne({ where: { templateId: id, isActive: true } });
        const rematerializeAssignments =
          !previousActive ||
          this.scheduleAffectingSchemaChanged(
            (previousActive.schemaSnapshot || null) as Record<string, any> | null,
            (saved.schema || null) as Record<string, any> | null,
          );

        const published = await this.publishInternal(req, saved, actorId, {
          rematerializeAssignments,
        });
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
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      if (template.status === TemplateStatus.ARCHIVED) {
        throw new BadRequestException('Cannot publish an archived template');
      }

      const actorId = this.getActorId(req);
      // Compare against the current active version before it is deactivated by createVersion.
      const previousActive = await versionRepo.findOne({
        where: { templateId: id, isActive: true },
      });
      const rematerializeAssignments =
        !previousActive ||
        this.scheduleAffectingSchemaChanged(
          previousActive.schemaSnapshot as Record<string, any> | null,
          template.schema as Record<string, any> | null,
        );

      const published = await this.publishInternal(req, template, actorId, {
        rematerializeAssignments,
      });

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

  private async archiveInternal(
    req: any,
    template: DataCollectionTemplate,
    actorId: number | null,
  ) {
    const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);

    if (template.status === TemplateStatus.ARCHIVED && !template.isActive) {
      await this.assignmentsService.cancelOpenAssignmentsForTemplate(req, template.id);
      return template;
    }

    template.status = TemplateStatus.ARCHIVED;
    template.isActive = false;
    template.updatedBy = actorId;
    const saved = await templateRepo.save(template);
    await this.assignmentsService.cancelOpenAssignmentsForTemplate(req, template.id);
    return saved;
  }

  async remove(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      const saved = await this.archiveInternal(req, template, this.getActorId(req));
      return {
        success: true,
        message: 'Template deleted and moved to archive',
        data: saved,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete template');
    }
  }

  async bulkRemove(req: any, ids: number[]) {
    try {
      const uniqueIds = [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id)))];
      if (!uniqueIds.length) {
        throw new BadRequestException('At least one valid ID is required');
      }

      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const templates = await templateRepo.findBy({ id: In(uniqueIds) });
      const foundIds = templates.map((template) => template.id);
      const missingIds = uniqueIds.filter((id) => !foundIds.includes(id));

      if (missingIds.length) {
        throw new NotFoundException(`Templates not found for IDs: ${missingIds.join(', ')}`);
      }

      const actorId = this.getActorId(req);
      const archived: DataCollectionTemplate[] = [];
      for (const template of templates) {
        archived.push(await this.archiveInternal(req, template, actorId));
      }

      return {
        success: true,
        message: `${foundIds.length} template(s) deleted and moved to archive`,
        data: { deletedIds: foundIds, count: foundIds.length, templates: archived },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to bulk delete templates');
    }
  }

  async activate(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      if (template.status === TemplateStatus.ARCHIVED) {
        throw new BadRequestException(
          'Archived templates must be restored before activating',
        );
      }

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

      const saved = await this.archiveInternal(req, template, this.getActorId(req));
      return { success: true, message: 'Template archived successfully', data: saved };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to archive template');
    }
  }

  /**
   * Restore an archived template so it can appear on the employee portal again.
   * Rematerializes from the published version using restore-safe occurrence rules
   * (reactivate archive-cancelled; never reopen completed or manually cancelled).
   */
  async restore(req: any, id: number) {
    try {
      const templateRepo = req.tenantConnection.getRepository(DataCollectionTemplate);
      const versionRepo = req.tenantConnection.getRepository(TemplateVersion);
      const template = await templateRepo.findOne({ where: { id } });
      if (!template) throw new NotFoundException(`Template with ID ${id} not found`);

      if (template.status !== TemplateStatus.ARCHIVED) {
        throw new BadRequestException('Only archived templates can be restored');
      }

      const actorId = this.getActorId(req);
      const activeVersion = await versionRepo.findOne({
        where: { templateId: id, isActive: true },
      });

      if (activeVersion) {
        template.status = TemplateStatus.ACTIVE;
        template.isActive = true;
        template.updatedBy = actorId;
        const saved = await templateRepo.save(template);

        const assignments = await this.assignmentsService.materializeFromTemplate(
          req,
          saved,
          activeVersion,
          actorId,
        );

        return {
          success: true,
          message: 'Template restored successfully',
          data: saved,
          version: activeVersion,
          assignmentsCreated: assignments.length,
        };
      }

      template.status = TemplateStatus.DRAFT;
      template.isActive = true;
      template.updatedBy = actorId;
      const saved = await templateRepo.save(template);

      return {
        success: true,
        message: 'Template restored as draft (no published version found)',
        data: saved,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to restore template');
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
