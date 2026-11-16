/**
 * Typed reads of raw profile JSON. The builder writes profile sections into the generated code as they are stored
 * (same values, same key order as dashboard-v2), so it reads them in place instead of re-parsing copies.
 * Each helper returns a safe empty value when the data is not of the expected kind.
 */
export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value at `key` of a record, or undefined. */
export function field(value: unknown, key: string): unknown {
  return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

export function record(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

export function list(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export function strings(value: unknown): string[] {
  return list(value).filter((entry): entry is string => typeof entry === 'string');
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** JavaScript truthiness, as v2's `!!value` and `value ||` read it. */
export function truthy(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== 0 && value !== '' && !Number.isNaN(value);
}

/** `value || fallback` in v2: the record when present and truthy, the fallback otherwise. */
export function recordOr(value: unknown, fallback: JsonRecord): JsonRecord {
  return isRecord(value) ? value : fallback;
}

/** `value ?? fallback`: the fallback only for undefined or null. */
export function nullishOr(value: unknown, fallback: unknown): unknown {
  return value ?? fallback;
}
