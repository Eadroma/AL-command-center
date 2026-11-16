/**
 * Builds one character's deployable CODE bundle: validate the profile, adapt the script, compile to ES2017 with
 * esbuild (same version and options as dashboard-v2, so bundles are identical), and optionally append telemetry.
 * Building writes nothing and starts nothing; deployment is a separate, explicit step.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';
import type { Profile } from '../../shared/profile.ts';
import type { AdaptedSource } from './adapt-source.ts';
import { adaptSource } from './adapt-source.ts';
import type { ScriptInfo } from './catalogue.ts';
import type { GameFacts } from './validate.ts';
import { validateProfile } from './validate.ts';

export interface BuildInput {
  readonly profile: Profile;
  readonly character: string;
  readonly scripts: readonly ScriptInfo[];
  readonly facts: GameFacts;
  readonly codeDirectory: string;
}

export interface Bundle extends AdaptedSource {
  readonly hash: string;
  readonly filename: string;
  readonly sourceHash: string;
}

export type BuildResult = { readonly ok: true; readonly bundle: Bundle } | { readonly ok: false; readonly error: string };

export async function buildBundle(input: BuildInput): Promise<BuildResult> {
  const invalid = validateProfile(input.profile, input.scripts, input.facts);
  if (invalid !== null) {
    return { ok: false, error: invalid };
  }
  const character = input.profile.characters.find((entry) => entry.name === input.character);
  const script = input.scripts.find((entry) => entry.id === character?.script);
  if (character === undefined || script === undefined) {
    return { ok: false, error: 'Unknown character.' };
  }
  let adapted: AdaptedSource;
  try {
    adapted = adaptSource({ source: readFileSync(path.join(input.codeDirectory, script.filename), 'utf8'), profile: input.profile, character, script, codeDirectory: input.codeDirectory });
  } catch (error) {
    // Merchant policy errors stop the build with their message (same as v2).
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const compiled = await transform(adapted.code, { loader: 'js', target: 'es2017', minify: false, legalComments: 'inline' });
  return {
    ok: true,
    bundle: {
      ...adapted,
      code: compiled.code,
      hash: createHash('sha256').update(compiled.code).digest('hex'),
      filename: `${character.name}.${character.runtime}.js`,
      sourceHash: script.hash,
    },
  };
}

export interface TelemetryTarget {
  /** Full URL of POST /api/telemetry as the game client can reach it. */
  readonly endpoint: string;
  readonly character: string;
  /** Random 256-bit hex ticket; the server keeps only its SHA-256 (see server/telemetry/store.ts). */
  readonly ticket: string;
  /** Priest whose heal range counts as healer coverage (dashboard-v2 hard-coded "Aedroma"). */
  readonly priest: string;
  readonly codeDirectory: string;
}

const TEMPLATE = readFileSync(path.join(import.meta.dirname, 'runtime', 'telemetry.js'), 'utf8');

/** The bundle followed by the telemetry reporter (template extracted from dashboard-v2 by tools/golden-v2.mts). */
export function instrument(code: string, target: TelemetryTarget): string {
  const values: Readonly<Record<string, string>> = {
    __ALCC_ENDPOINT__: JSON.stringify(target.endpoint),
    __ALCC_TICKET__: JSON.stringify(target.ticket),
    __ALCC_CHARACTER__: JSON.stringify(target.character),
    __ALCC_PRIEST__: JSON.stringify(target.priest),
    __ALCC_COMMAND_INBOX__: readFileSync(path.join(target.codeDirectory, 'runtime-command-inbox.js'), 'utf8'),
  };
  // Markers are replaced in the template only, never in the player's code.
  const reporter = Object.entries(values).reduce((text, [marker, value]) => text.split(marker).join(value), TEMPLATE);
  return `${code}${reporter}`;
}

/** Where scripts send telemetry: the public address in hosted mode, this machine otherwise. */
export function telemetryEndpoint(dashboard: { readonly publicUrl: string; readonly port: number }): string {
  return dashboard.publicUrl === '' ? `http://127.0.0.1:${String(dashboard.port)}/api/telemetry` : new URL('/api/telemetry', dashboard.publicUrl).toString();
}
