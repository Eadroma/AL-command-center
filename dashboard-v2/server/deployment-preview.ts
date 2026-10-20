import { ast } from './scripts';

/** Parse generated JSON literals without executing CODE from the game. */
export function injectedSettings(code: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const node of ast(code).body) {
    if (node.type !== 'VariableDeclaration') continue;
    for (const declaration of node.declarations) {
      if (!['CONFIG', '__ALCC', 'BOARD_CTL', 'HUNT_ALLOW', 'BOSS_CHECKS'].includes(declaration.id.name) || !declaration.init) continue;
      try { result[declaration.id.name] = JSON.parse(code.slice(declaration.init.start, declaration.init.end)); } catch { /* Legacy non-JSON CONFIG remains unknown. */ }
    }
  }
  return result;
}

export function settingsChanges(before: Record<string, unknown>, after: Record<string, unknown>) {
  const rows: Array<{ key: string; before: unknown; after: unknown }> = [];
  for (const section of Object.keys(after)) {
    const old = before[section]; const next = after[section];
    if (old && next && typeof old === 'object' && typeof next === 'object' && !Array.isArray(old) && !Array.isArray(next)) {
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        const previous = (old as Record<string, unknown>)[key]; const value = (next as Record<string, unknown>)[key];
        if (JSON.stringify(previous) !== JSON.stringify(value)) rows.push({ key: `${section}.${key}`, before: previous, after: value });
      }
    } else if (JSON.stringify(old) !== JSON.stringify(next)) rows.push({ key: section, before: old, after: next });
  }
  return rows;
}
