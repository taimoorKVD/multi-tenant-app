function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((accumulator, part) => {
    if (accumulator && typeof accumulator === 'object' && part in (accumulator as object)) {
      return (accumulator as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);
}

export function extractPlaceholders(template: string): string[] {
  const matches = template.match(/\{([a-zA-Z0-9_.-]+)\}/g) || [];
  return Array.from(new Set(matches.map((match) => match.slice(1, -1))));
}

export function assertTemplateVariables(
  template: string,
  data: Record<string, unknown>,
): string[] {
  return extractPlaceholders(template).filter((placeholder) => {
    const value = getValue(data, placeholder);
    return typeof value === 'undefined' || value === null;
  });
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  options?: { escape?: boolean },
): string {
  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_match, token) => {
    const value = getValue(data, token);
    if (typeof value === 'undefined' || value === null) {
      return '';
    }

    const normalized = String(value);
    return options?.escape === false ? normalized : escapeHtml(normalized);
  });
}

export function normalizeEmailList(input?: string | string[] | null): string[] {
  if (!input) {
    return [];
  }

  const rawValues = Array.isArray(input) ? input : input.split(',');
  return Array.from(
    new Set(
      rawValues
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.toLowerCase()),
    ),
  );
}