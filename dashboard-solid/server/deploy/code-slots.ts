/**
 * Writes a bundle into the character's `CC_<name>` CODE slot, the way dashboard-v2 does:
 * the character must be online (unless only preparing), the slot is reused or the highest free number is taken,
 * the slot's current code is backed up first, the upload is read back and compared, and only then a reload is
 * requested. A reload request is not proof the new code runs: telemetry confirms it.
 * Response shapes were recorded from the game API on 2026-10-27 (read-only calls).
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { McpClient, McpError } from '../mcp/client.ts';

export type DeployErrorCode = 'deploy.offline' | 'deploy.duplicateSlots' | 'deploy.noFreeSlot' | 'deploy.backupFailed' | 'deploy.verifyFailed' | 'deploy.unexpectedResponse' | 'deploy.noSlot';

export interface DeployError {
  readonly code: DeployErrorCode | McpError['code'];
  readonly detail?: string;
}

export type DeployStage = 'checking' | 'choosingSlot' | 'backingUp' | 'uploading' | 'verifying' | 'reloading';

export type SlotResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: DeployError };

export const statusSchema = z.looseObject({ online: z.boolean(), code_running: z.boolean().catch(false) });
const codesSchema = z.looseObject({ codes: z.array(z.looseObject({ slot: z.union([z.string(), z.number()]).transform(String), name: z.string() })) });
const codeSchema = z.looseObject({ code: z.looseObject({ code: z.string(), name: z.string().optional() }) });

/** One call, its answer validated; a failed or unexpected answer becomes an error value. */
async function ask<T>(client: McpClient, request: { readonly method: string; readonly args: Readonly<Record<string, unknown>> }, schema: z.ZodType<T>): Promise<SlotResult<T>> {
  const { method } = request;
  const result = await client.call(method, request.args);
  if (!result.ok) {
    return result;
  }
  const parsed = schema.safeParse(result.value);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: { code: 'deploy.unexpectedResponse', detail: method } };
}

export const slotName = (character: string): string => `CC_${character}`;

/** The character's own slot, or the highest free numbered slot (100 down to 1). */
export async function findSlot(client: McpClient, character: string, createIfMissing: boolean): Promise<SlotResult<{ readonly slot: string; readonly exists: boolean }>> {
  const listed = await ask(client, { method: 'list_codes', args: {} }, codesSchema);
  if (!listed.ok) {
    return listed;
  }
  const own = listed.value.codes.filter((entry) => entry.name === slotName(character));
  if (own.length > 1) {
    return { ok: false, error: { code: 'deploy.duplicateSlots', detail: slotName(character) } };
  }
  const [existing] = own;
  if (existing !== undefined) {
    return { ok: true, value: { slot: existing.slot, exists: true } };
  }
  if (!createIfMissing) {
    return { ok: false, error: { code: 'deploy.noSlot', detail: slotName(character) } };
  }
  const used = new Set(listed.value.codes.map((entry) => entry.slot));
  const free = Array.from({ length: 100 }, (_, index) => String(100 - index)).find((slot) => !used.has(slot));
  return free === undefined ? { ok: false, error: { code: 'deploy.noFreeSlot' } } : { ok: true, value: { slot: free, exists: false } };
}

/** One slot's code (read-only). */
export async function readCode(client: McpClient, slot: string): Promise<SlotResult<{ readonly code: string; readonly name: string | null }>> {
  const read = await ask(client, { method: 'get_code', args: { slot } }, codeSchema);
  return read.ok ? { ok: true, value: { code: read.value.code.code, name: read.value.code.name ?? null } } : read;
}

async function backup(client: McpClient, input: { readonly character: string; readonly slot: string; readonly directory: string }): Promise<SlotResult<null>> {
  const current = await ask(client, { method: 'get_code', args: { slot: input.slot } }, codeSchema);
  if (!current.ok) {
    return { ok: false, error: { code: 'deploy.backupFailed', detail: current.error.code } };
  }
  await mkdir(input.directory, { recursive: true });
  const record = { character: input.character, slot: input.slot, at: new Date().toISOString(), ...current.value.code };
  await writeFile(path.join(input.directory, `${randomUUID()}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
  return { ok: true, value: null };
}

export interface UploadInput {
  readonly client: McpClient;
  readonly character: string;
  readonly code: string;
  readonly backupDirectory: string;
  /** Upload and verify only: the character may be offline and is not started. */
  readonly prepareOnly: boolean;
  readonly progress: (stage: DeployStage) => void;
}

export interface Uploaded {
  readonly slot: string;
  readonly name: string;
  readonly reloadRequested: boolean;
}

/** Browser CODE needs the character connected in an open game client. */
async function requireOnline(input: UploadInput): Promise<SlotResult<null>> {
  input.progress('checking');
  const status = await ask(input.client, { method: 'browser_code_status', args: { character: input.character } }, statusSchema);
  if (!status.ok) {
    return status;
  }
  return status.value.online ? { ok: true, value: null } : { ok: false, error: { code: 'deploy.offline', detail: input.character } };
}

export async function uploadCode(input: UploadInput): Promise<SlotResult<Uploaded>> {
  const { client, character, progress } = input;
  if (!input.prepareOnly) {
    const online = await requireOnline(input);
    if (!online.ok) {
      return online;
    }
  }
  progress('choosingSlot');
  const found = await findSlot(client, character, true);
  if (!found.ok) {
    return found;
  }
  const { slot } = found.value;
  if (found.value.exists) {
    progress('backingUp');
    const saved = await backup(client, { character, slot, directory: input.backupDirectory });
    if (!saved.ok) {
      return saved;
    }
  }
  return writeAndReload(input, slot);
}

async function writeAndReload(input: UploadInput, slot: string): Promise<SlotResult<Uploaded>> {
  const { client, character, code, progress } = input;
  progress('uploading');
  const written = await client.call('save_code', { slot, name: slotName(character), code });
  if (!written.ok) {
    return written;
  }
  progress('verifying');
  const uploaded = await ask(client, { method: 'get_code', args: { slot } }, codeSchema);
  if (!uploaded.ok || uploaded.value.code.code !== code) {
    return { ok: false, error: { code: 'deploy.verifyFailed', detail: slot } };
  }
  if (input.prepareOnly) {
    return { ok: true, value: { slot, name: slotName(character), reloadRequested: false } };
  }
  progress('reloading');
  const reloaded = await client.call('browser_code_reload', { character, slot });
  return reloaded.ok ? { ok: true, value: { slot, name: slotName(character), reloadRequested: true } } : reloaded;
}

/**
 * Puts older code back into a known slot: the character must be online, the slot's current code is backed up first
 * (so a rollback can itself be undone), then the same upload, read-back check and reload as a deployment.
 */
export async function restoreCode(input: UploadInput, slot: string): Promise<SlotResult<Uploaded>> {
  const online = await requireOnline(input);
  if (!online.ok) {
    return online;
  }
  input.progress('backingUp');
  const saved = await backup(input.client, { character: input.character, slot, directory: input.backupDirectory });
  return saved.ok ? writeAndReload({ ...input, prepareOnly: false }, slot) : saved;
}
