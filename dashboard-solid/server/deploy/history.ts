/**
 * CODE backups written before every slot replacement (code-backups/ in the data folder), newest first, and the
 * telemetry stripping a rollback needs: the restored code gets a fresh ticket instead of replaying an expired one.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Literal } from 'acorn';
import { z } from 'zod';
import type { Backup } from '../../shared/deploy.ts';
import { parseScript } from '../builder/catalogue.ts';

const KEPT = 100;
const ID = /^[a-f0-9-]{36}$/;

export const backupFileSchema = z.looseObject({
  character: z.string().regex(/^[\w-]+$/),
  slot: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+$/)),
  name: z.string().optional(),
  at: z.string(),
  code: z.string(),
});

export type BackupFile = z.infer<typeof backupFileSchema>;

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export async function readBackup(directory: string, id: string): Promise<BackupFile | null> {
  if (!ID.test(id)) {
    return null;
  }
  const text = await readFile(path.join(directory, `${id}.json`), 'utf8').catch(() => null);
  const parsed = backupFileSchema.safeParse(text === null ? null : JSON.parse(text));
  return parsed.success ? parsed.data : null;
}

export async function listBackups(directory: string): Promise<Backup[]> {
  const files = (await readdir(directory).catch(() => [])).filter((file) => ID.test(file.slice(0, -5)) && file.endsWith('.json'));
  const dated = await Promise.all(files.map(async (file) => ({ file, mtime: (await stat(path.join(directory, file))).mtimeMs })));
  dated.sort((a, b) => b.mtime - a.mtime);
  const rows = await Promise.all(dated.slice(0, KEPT).map(async ({ file }): Promise<Backup | null> => {
    const id = file.slice(0, -5);
    const backup = await readBackup(directory, id);
    return backup === null ? null : { id, character: backup.character, slot: backup.slot, name: backup.name ?? `CC_${backup.character}`, at: backup.at, bytes: Buffer.byteLength(backup.code), hash: sha256(backup.code) };
  }));
  return rows.filter((row): row is Backup => row !== null);
}

const TELEMETRY_ENDPOINT = /^https?:\/\/[^\s"']+\/api\/telemetry$/;

/** The literal variables at the top of a trailing `(function(){ var … })()`, and where that statement starts. */
function trailingWrapper(code: string): { readonly start: number; readonly values: Readonly<Record<string, unknown>> } | null {
  const last = parseScript(code).body.at(-1);
  const call = last?.type === 'ExpressionStatement' ? last.expression : null;
  if (call?.type !== 'CallExpression' || call.arguments.length > 0 || call.callee.type !== 'FunctionExpression' || last === undefined) {
    return null;
  }
  const first = call.callee.body.body[0];
  if (first?.type !== 'VariableDeclaration') {
    return null;
  }
  const values = Object.fromEntries(first.declarations.flatMap((declaration) => (declaration.id.type === 'Identifier' && declaration.init?.type === 'Literal'
    ? [[declaration.id.name, (declaration.init satisfies Literal).value]]
    : [])));
  return { start: last.start, values };
}

/**
 * The code without its trailing telemetry reporter, removed only when it is really ours: the last statement is
 * `(function(){ var endpoint=…, ticket=<64 hex>, expected=<character>; … })()` (dashboard-v2 and this dashboard
 * write the same wrapper). Anything else is returned untouched.
 */
export function withoutTelemetry(code: string, character: string): string {
  const wrapper = trailingWrapper(code);
  if (wrapper === null) {
    return code;
  }
  const { ticket, endpoint, expected } = wrapper.values;
  const ours = expected === character && typeof ticket === 'string' && /^[a-f0-9]{64}$/.test(ticket) && typeof endpoint === 'string' && TELEMETRY_ENDPOINT.test(endpoint);
  return ours ? code.slice(0, wrapper.start) : code;
}
