export type TemplateReferenceEndpoint =
  | 'users'
  | 'user'
  | 'jobpositions'
  | 'jobposition'
  | 'job-positions'
  | 'vendors'
  | 'vendor'
  | 'items'
  | 'item'
  | 'locations'
  | 'location';

function normalize(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object') return normalize((value as any).id);
  return null;
}

function normalizeEndpoint(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, '');
}

function singularEndpoint(endpoint: string): string {
  const normalized = normalizeEndpoint(endpoint);
  if (normalized.endsWith('ies')) return normalized.slice(0, -3) + 'y';
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized;
}

function containsId(value: unknown, ids: Set<number>, visited: Set<object>): boolean {
  if (value === null || value === undefined || typeof value === 'boolean') return false;
  if (typeof value === 'number' || typeof value === 'string') return ids.has(normalize(value) as number);
  if (Array.isArray(value)) return value.some((item) => containsId(item, ids, visited));
  if (typeof value !== 'object') return false;
  if (visited.has(value as object)) return false;
  visited.add(value as object);

  return Object.values(value as Record<string, unknown>).some((child) => containsId(child, ids, visited));
}

export function templateSchemaContainsReference(
  value: unknown,
  endpoint: TemplateReferenceEndpoint,
  referenceIds: number[],
): boolean {
  const ids = new Set(referenceIds);
  if (!ids.size || value === null || value === undefined) return false;

  const target = normalizeEndpoint(endpoint);
  const targetSingular = singularEndpoint(endpoint);

  const visit = (current: unknown, visited = new Set<object>()): boolean => {
    if (Array.isArray(current)) return current.some((child) => visit(child, visited));
    if (!current || typeof current !== 'object') return false;
    if (visited.has(current as object)) return false;
    visited.add(current as object);

    const record = current as Record<string, unknown>;
    const optionSource = record.optionSource as Record<string, unknown> | undefined;
    const endpointValue = optionSource?.endpoint ?? record.endpoint;

    if (normalizeEndpoint(endpointValue) === target || normalizeEndpoint(endpointValue) === targetSingular) {
      for (const [key, child] of Object.entries(record)) {
        const keyNormalized = normalizeEndpoint(key);
        if (keyNormalized !== 'optionsource' && containsId(child, ids, new Set<object>())) return true;
      }
    }

    for (const [key, child] of Object.entries(record)) {
      const keyNormalized = normalizeEndpoint(key);
      if (
        (keyNormalized === target || keyNormalized === targetSingular) &&
        containsId(child, ids, new Set<object>())
      ) {
        return true;
      }
      if (visit(child, visited)) return true;
    }
    return false;
  };

  return visit(value);
}
