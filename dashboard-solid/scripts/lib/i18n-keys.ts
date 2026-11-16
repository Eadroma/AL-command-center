/** Pure helpers behind `pnpm i18n:check`: dictionary keys and their usage in source files. */

type Dictionary = Readonly<Record<string, unknown>>;

function isDictionary(value: unknown): value is Dictionary {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dotted leaf keys of a nested dictionary (functions count as leaves). */
export function flattenKeys(dictionary: Dictionary, prefix = ''): string[] {
  return Object.entries(dictionary).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return isDictionary(value) ? flattenKeys(value, path) : [path];
  });
}

/** Leaf values that are plain strings, keyed by dotted path. */
export function stringLeaves(dictionary: Dictionary): Map<string, string> {
  const leaves = new Map<string, string>();
  const walk = (node: Dictionary, prefix: string): void => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      if (isDictionary(value)) {
        walk(value, path);
      } else if (typeof value === 'string') {
        leaves.set(path, value);
      }
    }
  };
  walk(dictionary, '');
  return leaves;
}

/**
 * Keys used by `t('a.b')` calls, plus prefixes used by template keys such as t(`languages.${code}`),
 * which mark every key under that prefix as used.
 */
export function findUsage(sources: readonly string[]): { readonly keys: Set<string>; readonly prefixes: Set<string> } {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(/\bt\(\s*'([\w.]+)'/g)) {
      if (match[1] !== undefined) {
        keys.add(match[1]);
      }
    }
    for (const match of source.matchAll(/\bt\(\s*`([\w.]*)\$\{/g)) {
      if (match[1] !== undefined) {
        prefixes.add(match[1]);
      }
    }
  }
  return { keys, prefixes };
}

export function findUnusedKeys(allKeys: readonly string[], sources: readonly string[]): string[] {
  const usage = findUsage(sources);
  return allKeys.filter((key) => !usage.keys.has(key) && ![...usage.prefixes].some((prefix) => key.startsWith(prefix)));
}

/** Keys whose French text is still identical to the English one, outside the explicit allowlist. */
export function findUntranslated(english: Dictionary, french: Dictionary, allowedPrefixes: readonly string[]): string[] {
  const frenchLeaves = stringLeaves(french);
  return [...stringLeaves(english)]
    .filter(([key, text]) => frenchLeaves.get(key) === text && !allowedPrefixes.some((prefix) => key.startsWith(prefix)))
    .map(([key]) => key);
}
