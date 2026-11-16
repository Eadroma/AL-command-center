/**
 * Server configuration resolved at startup.
 * Priority everywhere: environment variable, then settings.json, then default.
 */
import path from 'node:path';

export const DEFAULT_PORT = 9320;

/** Directory holding the compiled UI served in production. */
export const distDirectory = path.resolve(import.meta.dirname, '..', 'dist');

export function resolvePort(environment: NodeJS.ProcessEnv, fallback: number = DEFAULT_PORT): number {
  const raw = environment['ALCC_PORT'];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
    throw new Error(`ALCC_PORT must be an integer between 1024 and 65535, got "${raw}".`);
  }
  return port;
}
