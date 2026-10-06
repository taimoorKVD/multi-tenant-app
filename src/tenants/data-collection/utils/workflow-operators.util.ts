import { WorkflowConditionOperator } from '../entities/enums';

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(asString).join(',');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'checked', 'on'].includes(normalized);
  }
  return !isEmptyValue(value);
}

const TIME_ONLY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toMinutes(value: string): number | null {
  const match = TIME_ONLY.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 60 + minutes + seconds / 60;
}

function toEpoch(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  const raw = asString(value).trim();
  if (!raw) return null;
  if (DATE_ONLY.test(raw) && !raw.includes('T')) {
    const t = Date.parse(`${raw}T00:00:00`);
    return Number.isNaN(t) ? null : t;
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : t;
}

function looksLikeTime(value: unknown): boolean {
  return TIME_ONLY.test(asString(value).trim());
}

function looksLikeDateOrDateTime(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const raw = asString(value).trim();
  if (!raw) return false;
  if (DATE_ONLY.test(raw)) return true;
  return !Number.isNaN(Date.parse(raw));
}

const NUMERIC_LITERAL = /^-?\d+(\.\d+)?$/;

export function compareWorkflowValues(
  operator: WorkflowConditionOperator | string,
  left: unknown,
  right: unknown,
): boolean {
  switch (operator) {
    case WorkflowConditionOperator.IS_EMPTY:
      return isEmptyValue(left);
    case WorkflowConditionOperator.IS_NOT_EMPTY:
      return !isEmptyValue(left);
    case WorkflowConditionOperator.CHECKED:
      return asBoolean(left) === true;
    case WorkflowConditionOperator.UNCHECKED:
      return asBoolean(left) !== true;
    case WorkflowConditionOperator.EQUALS:
      return valuesEqual(left, right);
    case WorkflowConditionOperator.NOT_EQUALS:
      return !valuesEqual(left, right);
    case WorkflowConditionOperator.CONTAINS:
      return asString(left).toLowerCase().includes(asString(right).toLowerCase());
    case WorkflowConditionOperator.NOT_CONTAINS:
      return !asString(left).toLowerCase().includes(asString(right).toLowerCase());
    case WorkflowConditionOperator.STARTS_WITH:
      return asString(left).toLowerCase().startsWith(asString(right).toLowerCase());
    case WorkflowConditionOperator.ENDS_WITH:
      return asString(left).toLowerCase().endsWith(asString(right).toLowerCase());
    case WorkflowConditionOperator.GREATER_THAN:
    case WorkflowConditionOperator.GREATER_THAN_OR_EQUAL:
    case WorkflowConditionOperator.LESS_THAN:
    case WorkflowConditionOperator.LESS_THAN_OR_EQUAL: {
      const cmp = compareOrdered(left, right);
      if (cmp === null) return false;
      if (operator === WorkflowConditionOperator.GREATER_THAN) return cmp > 0;
      if (operator === WorkflowConditionOperator.GREATER_THAN_OR_EQUAL) return cmp >= 0;
      if (operator === WorkflowConditionOperator.LESS_THAN) return cmp < 0;
      return cmp <= 0;
    }
    default:
      return false;
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (looksLikeTime(left) && looksLikeTime(right)) {
    return toMinutes(asString(left)) === toMinutes(asString(right));
  }
  if (looksLikeDateOrDateTime(left) && looksLikeDateOrDateTime(right)) {
    return toEpoch(left) === toEpoch(right);
  }
  const leftRaw = asString(left).trim();
  const rightRaw = asString(right).trim();
  if (
    (typeof left === 'number' || NUMERIC_LITERAL.test(leftRaw)) &&
    (typeof right === 'number' || NUMERIC_LITERAL.test(rightRaw))
  ) {
    const leftNum = asNumber(left);
    const rightNum = asNumber(right);
    if (leftNum !== null && rightNum !== null) return leftNum === rightNum;
  }
  return leftRaw.toLowerCase() === rightRaw.toLowerCase();
}

function compareOrdered(left: unknown, right: unknown): number | null {
  if (looksLikeTime(left) && looksLikeTime(right)) {
    const l = toMinutes(asString(left));
    const r = toMinutes(asString(right));
    if (l === null || r === null) return null;
    return l === r ? 0 : l > r ? 1 : -1;
  }
  if (looksLikeDateOrDateTime(left) && looksLikeDateOrDateTime(right)) {
    const l = toEpoch(left);
    const r = toEpoch(right);
    if (l === null || r === null) return null;
    return l === r ? 0 : l > r ? 1 : -1;
  }
  const l = asNumber(left);
  const r = asNumber(right);
  if (l === null || r === null) return null;
  return l === r ? 0 : l > r ? 1 : -1;
}

export type SchemaFieldRef = {
  id?: string;
  name?: string;
  type?: string;
  optionSource?: { endpoint?: string };
};

export function collectSchemaFields(schema: Record<string, any> | null | undefined): SchemaFieldRef[] {
  const fields: SchemaFieldRef[] = [];
  const sections = Array.isArray(schema?.sections) ? schema!.sections : [];
  for (const section of sections) {
    const rows = Array.isArray(section?.rows) ? section.rows : [];
    for (const row of rows) {
      const rowFields = Array.isArray(row?.fields) ? row.fields : [];
      for (const field of rowFields) {
        if (field) fields.push(field);
      }
    }
  }
  return fields;
}

export function findSchemaField(
  fields: SchemaFieldRef[],
  fieldId: string | undefined,
): SchemaFieldRef | undefined {
  if (!fieldId) return undefined;
  return fields.find((field) => field.id === fieldId || field.name === fieldId);
}

export function relatedEndpointForField(field: SchemaFieldRef | undefined): string | null {
  const endpoint = String(field?.optionSource?.endpoint || '').trim().toLowerCase();
  if (!endpoint) return null;
  if (endpoint.includes('vendor')) return 'vendors';
  if (endpoint.includes('item')) return 'items';
  return endpoint;
}

export function pickRecordProperty(record: Record<string, any> | null | undefined, property?: string): unknown {
  if (!record || !property) return undefined;
  if (Object.prototype.hasOwnProperty.call(record, property)) return record[property];

  const lower = property.toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lower) return value;
  }

  const stripped = property.replace(/^fld_/i, '');
  for (const [key, value] of Object.entries(record)) {
    const keyLower = key.toLowerCase();
    if (keyLower === stripped.toLowerCase()) return value;
    if (keyLower.endsWith(`_${stripped.toLowerCase()}`)) return value;
    if (stripped.toLowerCase().endsWith(keyLower)) return value;
  }
  return undefined;
}

export function findValueByKeyHint(record: Record<string, any> | null | undefined, hints: string[]): unknown {
  if (!record) return undefined;
  const normalizedHints = hints.map((hint) => hint.toLowerCase());
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase().includes('password')) continue;
    const keyLower = key.toLowerCase();
    if (normalizedHints.some((hint) => keyLower === hint || keyLower.endsWith(`_${hint}`) || keyLower.includes(hint))) {
      if (!isEmptyValue(value)) return value;
    }
  }
  return undefined;
}

export function extractEntityId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return extractEntityId((value as { id: unknown }).id);
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function extractRequestDisplay(schema: Record<string, any>, answers: Record<string, any>) {
  const fields = collectSchemaFields(schema);
  const itemField = fields.find((field) => relatedEndpointForField(field) === 'items');
  const vendorField = fields.find((field) => relatedEndpointForField(field) === 'vendors');
  const qtyField = fields.find((field) => /^(qty|quantity|order_?qty)$/i.test(String(field.name || '')));
  const noteField = fields.find((field) => /^(note|notes|comment)$/i.test(String(field.name || '')));
  const costField = fields.find((field) => /^(cost|price|quoted_?cost)$/i.test(String(field.name || '')));

  const itemId = extractEntityId(itemField?.id ? answers[itemField.id] : undefined);
  const vendorId = extractEntityId(vendorField?.id ? answers[vendorField.id] : undefined);
  const quantityRaw = qtyField?.id ? answers[qtyField.id] : undefined;
  const quantity = asNumber(quantityRaw);
  const quoted = asNumber(costField?.id ? answers[costField.id] : undefined);
  const note = noteField?.id ? asString(answers[noteField.id]) || null : null;

  let itemLabel: string | null = null;
  if (itemField?.id && answers[itemField.id] && typeof answers[itemField.id] === 'object') {
    const obj = answers[itemField.id] as Record<string, any>;
    itemLabel = asString(obj.label || obj.name || obj.item_name) || null;
  }

  return {
    itemId,
    vendorId,
    quantity: quantity === null ? null : String(quantity),
    quotedPrice: quoted === null ? null : String(quoted),
    note,
    itemLabel,
  };
}
