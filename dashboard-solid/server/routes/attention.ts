/**
 * Dismissed attention signals, kept on disk so a dismissed incident stays hidden on every device and after a
 * restart. Only the signal keys are stored (the last 500), never their content.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Context, Hono } from 'hono';
import { z } from 'zod';

const KEPT = 500;
export const signalKeySchema = z.string().regex(/^[\w:.-]{1,160}$/);
const fileSchema = z.object({ dismissed: z.array(signalKeySchema) });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readDismissed(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8').catch(() => null);
  // A missing or corrupt file only means nothing is dismissed: incidents show again, nothing is lost.
  const parsed = fileSchema.safeParse(text === null ? null : parseJson(text));
  return parsed.success ? parsed.data.dismissed : [];
}

async function writeDismissed(file: string, dismissed: readonly string[]): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify({ dismissed }, null, 2)}\n`);
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function readKey(context: Context): Promise<string | null> {
  const body: unknown = await context.req.json().catch(() => null);
  const parsed = z.object({ key: signalKeySchema }).safeParse(body);
  return parsed.success ? parsed.data.key : null;
}

export function attentionRoutes(app: Hono, file: string): void {
  app.get('/api/attention', async (context) => context.json({ dismissed: await readDismissed(file) }));

  app.post('/api/attention/dismiss', async (context) => {
    const key = await readKey(context);
    if (key === null) {
      return context.json({ error: { code: 'attention.invalidKey' } }, 400);
    }
    const dismissed = [...(await readDismissed(file)).filter((existing) => existing !== key), key].slice(-KEPT);
    await writeDismissed(file, dismissed);
    return context.json({ dismissed });
  });
}
