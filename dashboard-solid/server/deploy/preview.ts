/**
 * Deployment preview: what would change if the saved profile were deployed now. Builds each enabled character
 * without a telemetry ticket, reads its current CODE slot (read-only calls) and compares the managed settings.
 * Never uploads, starts or creates anything: allowed even while deploy.enabled is false.
 */
import type { PreviewCharacter, PreviewChange, PreviewResult } from '../../shared/deploy.ts';
import type { SavedProfile } from '../../shared/profile.ts';
import { buildBundle } from '../builder/bundle.ts';
import type { ScriptInfo } from '../builder/catalogue.ts';
import { literalVariables } from '../builder/catalogue.ts';
import { field, isRecord, text } from '../../shared/raw.ts';
import type { GameFacts } from '../builder/validate.ts';
import type { McpClient } from '../mcp/client.ts';
import { findSlot, readCode } from './code-slots.ts';

const MANAGED_VARIABLES = ['CONFIG', '__ALCC', 'BOARD_CTL', 'HUNT_ALLOW', 'BOSS_CHECKS'];

/**
 * The managed variables of a bundle, read from its AST without running it. Works on both the generated source
 * (JSON literals) and the esbuild output (unquoted keys), unlike dashboard-v2's JSON.parse.
 */
export function injectedSettings(code: string): Record<string, unknown> {
  try {
    const values = literalVariables(code);
    return Object.fromEntries(MANAGED_VARIABLES.filter((name) => Object.hasOwn(values, name)).map((name) => [name, values[name]]));
  } catch {
    // Not parseable as a script (hand-written or broken slot): nothing to compare.
    return {};
  }
}

/** Changed keys, one level deep inside objects (CONFIG.NAME, __ALCC.listings…), as dashboard-v2 lists them. */
const differs = (a: unknown, b: unknown): boolean => JSON.stringify(a) !== JSON.stringify(b);

function sectionChanges(section: string, old: unknown, next: unknown): PreviewChange[] {
  if (!isRecord(old) || !isRecord(next)) {
    return differs(old, next) ? [{ key: section, before: old ?? null, after: next ?? null }] : [];
  }
  return [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter((key) => differs(old[key], next[key]))
    .map((key) => ({ key: `${section}.${key}`, before: old[key] ?? null, after: next[key] ?? null }));
}

export function settingsChanges(before: Readonly<Record<string, unknown>>, after: Readonly<Record<string, unknown>>): PreviewChange[] {
  return Object.keys(after).flatMap((section) => sectionChanges(section, before[section], after[section]));
}

export interface PreviewInput {
  readonly saved: SavedProfile;
  readonly scripts: readonly ScriptInfo[];
  readonly facts: GameFacts;
  readonly codeDirectory: string;
  readonly client: McpClient;
}

/** The deployed slot's settings, or why there is nothing to compare with. */
async function currentSlot(client: McpClient, name: string): Promise<{ readonly slot: string | null; readonly settings: Record<string, unknown>; readonly comparison: PreviewCharacter['comparison'] }> {
  const found = await findSlot(client, name, false);
  if (!found.ok) {
    return { slot: null, settings: {}, comparison: found.error.code === 'deploy.noSlot' ? 'noSlot' : 'unreadable' };
  }
  const code = await readCode(client, found.value.slot);
  const settings = code.ok ? injectedSettings(code.value.code) : {};
  return { slot: found.value.slot, settings, comparison: Object.keys(settings).length > 0 ? 'slot' : 'unreadable' };
}

async function previewOne(input: PreviewInput, name: string, script: string): Promise<PreviewCharacter> {
  const built = await buildBundle({ profile: input.saved.profile, character: name, scripts: input.scripts, facts: input.facts, codeDirectory: input.codeDirectory });
  if (!built.ok) {
    return { name, script, slot: null, comparison: 'noSlot', sourceChanged: null, changes: [], warnings: [], error: built.error };
  }
  const current = await currentSlot(input.client, name);
  const deployedSource = text(field(current.settings['__ALCC'], 'sourceHash'));
  return {
    name, script, slot: current.slot, comparison: current.comparison,
    sourceChanged: current.comparison === 'slot' ? deployedSource !== built.bundle.sourceHash : null,
    changes: settingsChanges(current.settings, injectedSettings(built.bundle.code)),
    warnings: built.bundle.warnings,
    error: null,
  };
}

export async function previewDeployment(input: PreviewInput): Promise<PreviewResult> {
  const characters: PreviewCharacter[] = [];
  for (const character of input.saved.profile.characters.filter((entry) => entry.enabled)) {
    characters.push(await previewOne(input, character.name, character.script));
  }
  return { revision: input.saved.revision, characters };
}

export type PreviewOutcome = { readonly ok: true; readonly result: PreviewResult } | { readonly ok: false; readonly error: { readonly code: string } };

/** Preview of the saved profile, if `revision` is still the saved one and game data is there. */
export async function previewSaved(input: Omit<PreviewInput, 'saved' | 'facts'> & { readonly saved: SavedProfile | null; readonly facts: GameFacts | null }, revision: number): Promise<PreviewOutcome> {
  const { saved, facts } = input;
  if (saved?.revision !== revision) {
    return { ok: false, error: { code: saved === null ? 'deploy.noProfile' : 'deploy.staleProfile' } };
  }
  if (facts === null) {
    return { ok: false, error: { code: 'deploy.noGameData' } };
  }
  return { ok: true, result: await previewDeployment({ ...input, saved, facts }) };
}
