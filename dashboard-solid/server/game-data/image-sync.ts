/**
 * Mirrors the game images locally (application folder, never git).
 * - The repository tree gives each file's git blob SHA: a file already on disk is never downloaded again.
 * - GitHub first, adventure.land as fallback; every file is checked (git hash, PNG header, expected size).
 * - The manifest is written last; above 2 % failures the previous manifest stays in place.
 */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { GameData } from './data-js.ts';
import type { ImageRef } from './images.ts';
import { checkImage, collectImages } from './images.ts';

const TREE_URL = 'https://api.github.com/repos/kaansoral/adventureland_mongodb/git/trees/main?recursive=1';
const RAW_BASE = 'https://raw.githubusercontent.com/kaansoral/adventureland_mongodb/main';
const GAME_BASE = 'https://adventure.land';
const MAX_FAILURE_RATIO = 0.02;
const CONCURRENCY = 6;

const treeSchema = z.object({ truncated: z.boolean(), tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string() })) });
export const manifestSchema = z.object({ generatedAt: z.string(), files: z.record(z.string(), z.string()) });
export type ImageManifest = z.infer<typeof manifestSchema>;

export type SyncResult =
  | { readonly status: 'synced'; readonly total: number; readonly downloaded: number; readonly failed: readonly string[] }
  | { readonly status: 'failed'; readonly code: 'images.treeUnavailable' | 'images.tooManyFailures'; readonly failed: readonly string[] };

export function gitBlobSha(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(() => true, () => false);
}

async function writeAtomic(file: string, content: string | Uint8Array): Promise<void> {
  const temporary = `${file}.${String(process.pid)}.${String(Date.now())}.tmp`;
  try {
    await writeFile(temporary, content);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/** Network errors, 429 and 5xx are worth retrying; other failures (404…) are final. */
function isRetryable(response: Response | null): boolean {
  return response === null || response.status === 429 || response.status >= 500;
}

/** Retry-After when the server sends one, otherwise exponential backoff; never more than 10 s. */
function retryDelayMs(response: Response | null, attempt: number): number {
  const retryAfter = Number(response?.headers.get('retry-after') ?? Number.NaN);
  const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt;
  return Math.min(wait, 10_000);
}

/** GET with a timeout and polite retries (3 attempts). */
async function fetchBytes(fetchImpl: typeof fetch, url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchImpl(url, { headers: { 'user-agent': 'alcc-dashboard' }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (response?.ok === true) {
      return new Uint8Array(await response.arrayBuffer());
    }
    if (!isRetryable(response)) {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)));
  }
  return null;
}

export async function fetchTree(fetchImpl: typeof fetch): Promise<Map<string, string> | null> {
  const response = await fetchImpl(TREE_URL, { headers: { 'user-agent': 'alcc-dashboard' }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  const parsed = treeSchema.safeParse(response?.ok === true ? await response.json() : null);
  if (!parsed.success || parsed.data.truncated) {
    return null;
  }
  return new Map(parsed.data.tree.filter((entry) => entry.type === 'blob').map((entry) => [`/${entry.path}`, entry.sha]));
}

interface SyncContext {
  readonly directory: string;
  readonly fetchImpl: typeof fetch;
  readonly tree: ReadonlyMap<string, string>;
}

/** Local file name for one image, downloading it when needed; null when every source failed the checks. */
async function syncOne(context: SyncContext, image: ImageRef): Promise<{ readonly file: string | null; readonly downloaded: boolean }> {
  const sha = context.tree.get(image.path);
  if (sha !== undefined && await exists(path.join(context.directory, `${sha}.png`))) {
    return { file: `${sha}.png`, downloaded: false };
  }
  if (sha !== undefined) {
    const bytes = await fetchBytes(context.fetchImpl, RAW_BASE + image.path);
    if (bytes !== null && gitBlobSha(bytes) === sha && checkImage(bytes, image.expected) === 'ok') {
      await writeAtomic(path.join(context.directory, `${sha}.png`), bytes);
      return { file: `${sha}.png`, downloaded: true };
    }
  }
  const fallback = await fetchBytes(context.fetchImpl, `${GAME_BASE}${image.path}${image.query === '' ? '' : `?${image.query}`}`);
  if (fallback === null || checkImage(fallback, image.expected) !== 'ok') {
    return { file: null, downloaded: false };
  }
  const name = `s256-${createHash('sha256').update(fallback).digest('hex')}.png`;
  await writeAtomic(path.join(context.directory, name), fallback);
  return { file: name, downloaded: true };
}

export async function readManifest(directory: string): Promise<ImageManifest | null> {
  const text = await readFile(path.join(directory, 'manifest.json'), 'utf8').catch(() => null);
  const parsed = manifestSchema.safeParse(text === null ? null : JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

export async function syncImages(directory: string, data: GameData, fetchImpl: typeof fetch = fetch): Promise<SyncResult> {
  const tree = await fetchTree(fetchImpl);
  if (tree === null) {
    return { status: 'failed', code: 'images.treeUnavailable', failed: [] };
  }
  await mkdir(directory, { recursive: true });
  const images = collectImages(data);
  const files: Record<string, string> = {};
  const failed: string[] = [];
  let downloaded = 0;
  const queue = [...images];
  const worker = async (): Promise<void> => {
    for (let image = queue.shift(); image !== undefined; image = queue.shift()) {
      const result = await syncOne({ directory, fetchImpl, tree }, image);
      if (result.file === null) {
        failed.push(image.path);
      } else {
        files[image.path] = result.file;
        downloaded += result.downloaded ? 1 : 0;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (failed.length > images.length * MAX_FAILURE_RATIO) {
    return { status: 'failed', code: 'images.tooManyFailures', failed };
  }
  await writeAtomic(path.join(directory, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2)}\n`);
  return { status: 'synced', total: images.length, downloaded, failed };
}
