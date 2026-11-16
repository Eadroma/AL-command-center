/**
 * Reads and writes settings.json. Reading never throws: a missing or invalid file becomes a state
 * the UI turns into the Settings screen. Writing validates first and replaces the file atomically.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Settings, SettingsIssue, SettingsState } from '../../shared/settings.ts';
import { settingsSchema } from '../../shared/settings.ts';
import { resolvePort } from '../config.ts';

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function loadSettings(file: string): Promise<SettingsState> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return { status: 'missing', file };
    }
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'invalid', file, issues: [{ path: '', code: 'invalid_json' }] };
  }
  const parsed = settingsSchema.safeParse(json);
  if (!parsed.success) {
    const issues: SettingsIssue[] = parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), code: issue.code }));
    return { status: 'invalid', file, issues };
  }
  return { status: 'ready', file, settings: parsed.data };
}

/** Environment variables override the file (useful in CI or for a one-off test). */
export function applyEnvironment(settings: Settings, environment: NodeJS.ProcessEnv): Settings {
  const token = environment['AL_MCP_TOKEN'];
  return {
    ...settings,
    account: { ...settings.account, mcpToken: token !== undefined && token !== '' ? token : settings.account.mcpToken },
    dashboard: { ...settings.dashboard, port: resolvePort(environment, settings.dashboard.port) },
  };
}

/** Validates, then writes through a temporary file and a rename so a crash never leaves half a file. */
export async function saveSettings(file: string, settings: unknown): Promise<Settings> {
  const valid = settingsSchema.parse(settings);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(valid, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return valid;
}
