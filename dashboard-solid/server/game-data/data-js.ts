/**
 * adventure.land/data.js: the game definitions object `G`.
 * - Read without evaluating code: the file is `var G={…};` on its first line.
 * - Validated loosely: only the sections and fields the dashboard uses are required; game additions pass.
 * - Revalidated with a HEAD request without compression: the game server ignores If-None-Match on gzip
 *   responses, and fetch always asks for gzip (measured on 2026-10-26, see ADR 0004).
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';

export const DATA_JS_URL = 'https://adventure.land/data.js';

const recordOf = <T extends z.ZodType>(entry: T): z.ZodRecord<z.ZodString, T> => z.record(z.string(), entry);

export const gameDataSchema = z.looseObject({
  version: z.number(),
  items: recordOf(z.looseObject({ name: z.string(), type: z.string().optional(), g: z.number().optional(), skin: z.string().optional() })),
  monsters: recordOf(z.looseObject({ name: z.string(), hp: z.number(), xp: z.number().optional(), attack: z.number().optional() })),
  maps: recordOf(z.looseObject({ name: z.string().optional() })),
  classes: recordOf(z.looseObject({})),
  imagesets: recordOf(z.looseObject({ file: z.string().optional(), size: z.number().optional() })),
  // Most entries are [pack, x, y], but animated ones (doors, levers) are lists of frames: checked where used.
  positions: recordOf(z.array(z.unknown())),
  sprites: recordOf(z.looseObject({ file: z.string().optional() })),
  tilesets: recordOf(z.looseObject({ file: z.string().optional() })),
  // Checked map by map in terrain.ts.
  geometry: recordOf(z.unknown()).optional(),
});

export type GameData = z.infer<typeof gameDataSchema>;

export type ParseResult = { readonly ok: true; readonly data: GameData } | { readonly ok: false; readonly code: 'gameData.notDataJs' | 'gameData.invalidJson' | 'gameData.unexpectedShape'; readonly issues?: readonly string[] };

export function parseDataJs(source: string): ParseResult {
  const firstLine = source.split('\n', 1)[0] ?? '';
  if (!firstLine.startsWith('var G=')) {
    return { ok: false, code: 'gameData.notDataJs' };
  }
  let json: unknown;
  try {
    json = JSON.parse(firstLine.slice('var G='.length).replace(/;\s*$/, ''));
  } catch {
    return { ok: false, code: 'gameData.invalidJson' };
  }
  const parsed = gameDataSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, code: 'gameData.unexpectedShape', issues: parsed.error.issues.slice(0, 10).map((issue) => `${issue.path.join('.')}: ${issue.code}`) };
  }
  return { ok: true, data: parsed.data };
}

/** Hash of the content without `version`, so a version-only bump is recognised as "nothing changed". */
export function contentHash(data: GameData): string {
  const { version, ...content } = data;
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/** Top-level sections present in one snapshot and not the other. */
export function sectionChanges(previous: readonly string[], next: readonly string[]): { readonly added: string[]; readonly removed: string[] } {
  return {
    added: next.filter((section) => !previous.includes(section)),
    removed: previous.filter((section) => !next.includes(section)),
  };
}

/** ETag of the uncompressed file, the only one the server revalidates. */
export async function headEtag(fetchImpl: typeof fetch): Promise<string | null> {
  const response = await fetchImpl(DATA_JS_URL, { method: 'HEAD', headers: { 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(30_000) });
  return response.ok ? response.headers.get('etag') : null;
}

export async function downloadDataJs(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(DATA_JS_URL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`data.js: HTTP ${response.status}`);
  }
  return response.text();
}
