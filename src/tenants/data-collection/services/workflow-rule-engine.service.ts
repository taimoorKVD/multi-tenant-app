import { Injectable, Logger } from '@nestjs/common';
import { EntityDynamicData, DynamicModule } from '../../form-builder/entities';
import { Item } from '../../items/entities';
import { Vendor } from '../../vendors/entities';
import {
  WorkflowComparisonType,
  WorkflowConditionOperator,
  WorkflowMatchMode,
  WorkflowSkipReason,
} from '../entities/enums';
import {
  collectSchemaFields,
  compareWorkflowValues,
  extractEntityId,
  findSchemaField,
  pickRecordProperty,
  relatedEndpointForField,
} from '../utils/workflow-operators.util';

export type WorkflowEvalConditionResult = {
  id: string;
  fieldId: string;
  operator: string;
  matched: boolean;
  left: unknown;
  right: unknown;
  error?: string;
};

export type WorkflowEvalResult = {
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  matched: boolean;
  skipReason: WorkflowSkipReason | null;
  conditionResults: WorkflowEvalConditionResult[];
};

@Injectable()
export class WorkflowRuleEngineService {
  private readonly logger = new Logger(WorkflowRuleEngineService.name);

  async evaluateRule(
    req: any,
    rule: Record<string, any>,
    answers: Record<string, any>,
    schema: Record<string, any>,
  ): Promise<WorkflowEvalResult> {
    const ruleId = String(rule?.id || '');
    const ruleName = String(rule?.name || '');
    if (rule?.enabled === false) {
      return {
        ruleId,
        ruleName,
        enabled: false,
        matched: false,
        skipReason: WorkflowSkipReason.DISABLED,
        conditionResults: [],
      };
    }

    const matchMode =
      rule?.conditions?.match === WorkflowMatchMode.ANY ? WorkflowMatchMode.ANY : WorkflowMatchMode.ALL;
    const items: Array<Record<string, any>> = Array.isArray(rule?.conditions?.items)
      ? rule.conditions.items
      : [];

    if (!items.length) {
      return {
        ruleId,
        ruleName,
        enabled: true,
        matched: false,
        skipReason: WorkflowSkipReason.NO_MATCH,
        conditionResults: [],
      };
    }

    const conditionResults: WorkflowEvalConditionResult[] = [];
    try {
      for (const item of items) {
        conditionResults.push(await this.evaluateItem(req, item, answers, schema));
      }
    } catch (error) {
      this.logger.error(`Rule ${ruleId} evaluation failed: ${(error as Error).message}`);
      return {
        ruleId,
        ruleName,
        enabled: true,
        matched: false,
        skipReason: WorkflowSkipReason.ERROR,
        conditionResults,
      };
    }

    const matched =
      matchMode === WorkflowMatchMode.ANY
        ? conditionResults.some((row) => row.matched)
        : conditionResults.every((row) => row.matched);

    return {
      ruleId,
      ruleName,
      enabled: true,
      matched,
      skipReason: matched ? null : WorkflowSkipReason.NO_MATCH,
      conditionResults,
    };
  }

  private async evaluateItem(
    req: any,
    item: Record<string, any>,
    answers: Record<string, any>,
    schema: Record<string, any>,
  ): Promise<WorkflowEvalConditionResult> {
    const id = String(item?.id || '');
    const fieldId = String(item?.fieldId || '');
    const operator = String(item?.operator || '');
    const left = answers?.[fieldId];

    try {
      const right = await this.resolveComparison(req, item?.comparison, answers, schema);
      const matched = compareWorkflowValues(operator as WorkflowConditionOperator, left, right);
      return { id, fieldId, operator, matched, left, right };
    } catch (error) {
      return {
        id,
        fieldId,
        operator,
        matched: false,
        left,
        right: undefined,
        error: (error as Error).message,
      };
    }
  }

  private async resolveComparison(
    req: any,
    comparison: Record<string, any> | undefined,
    answers: Record<string, any>,
    schema: Record<string, any>,
  ): Promise<unknown> {
    const type = comparison?.type || WorkflowComparisonType.FIXED;
    if (type === WorkflowComparisonType.FIELD) {
      return answers?.[comparison?.fieldId];
    }
    if (type === WorkflowComparisonType.RELATED_DATA) {
      return this.resolveRelatedData(
        req,
        answers,
        schema,
        comparison?.sourceFieldId,
        comparison?.property,
      );
    }
    return comparison?.value;
  }

  async resolveRelatedData(
    req: any,
    answers: Record<string, any>,
    schema: Record<string, any>,
    sourceFieldId?: string,
    property?: string,
  ): Promise<unknown> {
    const entityId = extractEntityId(answers?.[sourceFieldId || '']);
    if (!entityId) return undefined;
    const fields = collectSchemaFields(schema);
    const sourceField = findSchemaField(fields, sourceFieldId);
    const endpoint = relatedEndpointForField(sourceField) || this.guessEndpoint(sourceFieldId);
    const record = await this.loadRelatedRecord(req, endpoint, entityId);
    return pickRecordProperty(record, property);
  }

  async loadRelatedRecord(
    req: any,
    endpoint: string | null,
    entityId: number,
  ): Promise<Record<string, any>> {
    if (!req?.tenantConnection || !endpoint) return {};
    const slug = endpoint;
    const core: Record<string, any> = { id: entityId };

    if (slug === 'vendors') {
      const vendor = await req.tenantConnection.getRepository(Vendor).findOne({ where: { id: entityId } });
      if (vendor) {
        core.vendor_name = vendor.vendorName;
        core.name = vendor.vendorName;
      }
    } else if (slug === 'items') {
      const item = await req.tenantConnection.getRepository(Item).findOne({ where: { id: entityId } });
      if (item) {
        core.item_name = item.itemName;
        core.name = item.itemName;
      }
    }

    const moduleRepo = req.tenantConnection.getRepository(DynamicModule);
    const moduleEntity = await moduleRepo.findOne({ where: { slug } });
    if (!moduleEntity) return core;

    const dynamicRepo = req.tenantConnection.getRepository(EntityDynamicData);
    const row = await dynamicRepo.findOne({
      where: { moduleId: moduleEntity.id, entityId },
    });
    return { ...core, ...(row?.data || {}) };
  }

  private guessEndpoint(sourceFieldId?: string): string | null {
    const raw = String(sourceFieldId || '').toLowerCase();
    if (raw.includes('vendor')) return 'vendors';
    if (raw.includes('item')) return 'items';
    return null;
  }
}
