/** Persists telemetry session identities (never the tickets themselves, only their SHA-256). */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { SessionRecord } from './store.ts';

const sessionsSchema = z.array(z.object({ id: z.string(), character: z.string(), ticketHash: z.string().regex(/^[0-9a-f]{64}$/), createdAt: z.number() }));

export async function readSessions(file: string): Promise<SessionRecord[]> {
  const text = await readFile(file, 'utf8').catch(() => null);
  const parsed = sessionsSchema.safeParse(text === null ? [] : JSON.parse(text));
  return parsed.success ? parsed.data : [];
}

export async function writeSessions(file: string, sessions: readonly SessionRecord[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(sessions, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}
