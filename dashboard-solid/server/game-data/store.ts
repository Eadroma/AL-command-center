/**
 * Local copy of the game data in the application folder (never in git):
 * `game-data/data.json` (validated G) and `game-data/meta.json` (ETag, version, hash, sections).
 * The update keeps the previous copy whenever anything fails.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { appendReport, buildReport } from './changes.ts';
import type { GameData } from './data-js.ts';
import { contentHash, downloadDataJs, gameDataSchema, headEtag, parseDataJs, sectionChanges } from './data-js.ts';

const metaSchema = z.object({
  etag: z.string().nullable(),
  version: z.number(),
  hash: z.string(),
  sections: z.array(z.string()),
  fetchedAt: z.string(),
  checkedAt: z.string(),
});

export type GameDataMeta = z.infer<typeof metaSchema>;

export type UpdateResult =
  | { readonly status: 'unchanged'; readonly meta: GameDataMeta }
  | { readonly status: 'versionOnly' | 'updated'; readonly meta: GameDataMeta; readonly sectionsAdded: readonly string[]; readonly sectionsRemoved: readonly string[] }
  | { readonly status: 'failed'; readonly code: string; readonly issues?: readonly string[]; readonly meta: GameDataMeta | null };

async function writeAtomic(file: string, content: string): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function readJsonFile(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export function gameDataDirectory(appDirectory: string): string {
  return path.join(appDirectory, 'game-data');
}

export async function readMeta(directory: string): Promise<GameDataMeta | null> {
  const parsed = metaSchema.safeParse(await readJsonFile(path.join(directory, 'meta.json')));
  return parsed.success ? parsed.data : null;
}

export async function readGameData(directory: string): Promise<GameData | null> {
  const parsed = gameDataSchema.safeParse(await readJsonFile(path.join(directory, 'data.json')));
  return parsed.success ? parsed.data : null;
}

async function saveSnapshot(directory: string, data: GameData, meta: GameDataMeta): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeAtomic(path.join(directory, 'data.json'), JSON.stringify(data));
  // Meta last: it is what marks the new snapshot as current.
  await writeAtomic(path.join(directory, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
}

interface UpdateContext {
  readonly directory: string;
  readonly fetchImpl: typeof fetch;
  readonly previous: GameDataMeta | null;
  readonly etag: string | null;
  readonly now: string;
}

async function markChecked(directory: string, previous: GameDataMeta, now: string): Promise<UpdateResult> {
  const meta = { ...previous, checkedAt: now };
  await writeAtomic(path.join(directory, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
  return { status: 'unchanged', meta };
}

async function downloadAndStore({ directory, fetchImpl, previous, etag, now }: UpdateContext): Promise<UpdateResult> {
  const parsed = parseDataJs(await downloadDataJs(fetchImpl));
  if (!parsed.ok) {
    return { status: 'failed', code: parsed.code, ...(parsed.issues === undefined ? {} : { issues: parsed.issues }), meta: previous };
  }
  const sections = Object.keys(parsed.data);
  const meta: GameDataMeta = { etag, version: parsed.data.version, hash: contentHash(parsed.data), sections, fetchedAt: now, checkedAt: now };
  const changes = sectionChanges(previous?.sections ?? sections, sections);
  const contentChanged = previous?.hash !== meta.hash;
  // Read the old snapshot before replacing it, to report what changed.
  const previousData = previous !== null && contentChanged ? await readGameData(directory) : null;
  await saveSnapshot(directory, parsed.data, meta);
  if (previousData !== null) {
    await appendReport(directory, buildReport(previousData, parsed.data, now));
  }
  return { status: contentChanged ? 'updated' : 'versionOnly', meta, sectionsAdded: changes.added, sectionsRemoved: changes.removed };
}

export async function updateGameData(directory: string, fetchImpl: typeof fetch = fetch): Promise<UpdateResult> {
  const previous = await readMeta(directory);
  const now = new Date().toISOString();
  try {
    const etag = await headEtag(fetchImpl);
    if (previous !== null && etag !== null && etag === previous.etag) {
      return await markChecked(directory, previous, now);
    }
    return await downloadAndStore({ directory, fetchImpl, previous, etag, now });
  } catch {
    return { status: 'failed', code: 'gameData.unreachable', meta: previous };
  }
}
