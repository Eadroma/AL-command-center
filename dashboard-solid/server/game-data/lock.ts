/**
 * Cross-process lock for the game data update: the server and `pnpm game:update` may run at the same time.
 * A lock file created exclusively holds the owner's pid; a lock whose owner died, or older than
 * 10 minutes, is considered abandoned and taken over.
 */
import { open, readFile, rm } from 'node:fs/promises';
import { z } from 'zod';

const STALE_AFTER_MS = 10 * 60_000;
const lockSchema = z.object({ pid: z.number(), at: z.number() });

export type ReleaseLock = () => Promise<void>;

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return error instanceof Error && 'code' in error && error.code === 'EPERM';
  }
}

async function isAbandoned(file: string, now: number, alive: (pid: number) => boolean): Promise<boolean> {
  const text = await readFile(file, 'utf8').catch(() => null);
  const parsed = lockSchema.safeParse(text === null ? null : JSON.parse(text));
  return !parsed.success || now - parsed.data.at > STALE_AFTER_MS || !alive(parsed.data.pid);
}

async function tryCreate(file: string, now: number): Promise<boolean> {
  try {
    const handle = await open(file, 'wx');
    await handle.writeFile(JSON.stringify({ pid: process.pid, at: now }));
    await handle.close();
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

/** Resolves to a release function, or null when another live process holds the lock. */
export async function acquireLock(file: string, now = Date.now(), alive: (pid: number) => boolean = isProcessAlive): Promise<ReleaseLock | null> {
  if (!await tryCreate(file, now)) {
    if (!await isAbandoned(file, now, alive)) {
      return null;
    }
    await rm(file, { force: true });
    if (!await tryCreate(file, now)) {
      return null;
    }
  }
  return async () => { await rm(file, { force: true }); };
}
