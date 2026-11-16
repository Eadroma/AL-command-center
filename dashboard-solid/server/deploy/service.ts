/**
 * Deployment: build the saved profile for one character, give the bundle a telemetry ticket, write it into the
 * character's CODE slot and request a reload; or start / stop CODE. Every action that touches the game is refused
 * while settings.json has deploy.enabled false (dashboard-v2 stays the only deployer during the migration).
 * One operation at a time; the state of each character is kept on disk and shown on the Team screen.
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { Backup, Deployment, DeployFailure, Deployments, PartyResult } from '../../shared/deploy.ts';
import type { PreviewOutcome } from './preview.ts';
import type { ProfileCharacter, SavedProfile } from '../../shared/profile.ts';
import type { Settings } from '../../shared/settings.ts';
import { buildBundle, instrument, telemetryEndpoint } from '../builder/bundle.ts';
import type { ScriptInfo } from '../builder/catalogue.ts';
import type { GameFacts } from '../builder/validate.ts';
import type { ProfileStore } from '../profile/store.ts';
import type { SettingsHolder } from '../settings/holder.ts';
import type { TelemetryStore } from '../telemetry/store.ts';
import { findSlot, restoreCode, statusSchema, uploadCode } from './code-slots.ts';
import { listBackups, readBackup, withoutTelemetry } from './history.ts';
import { previewSaved } from './preview.ts';
import type { DeploymentFile } from './state-file.ts';

export interface DeployServiceOptions {
  readonly settings: SettingsHolder;
  readonly profiles: ProfileStore;
  readonly telemetry: TelemetryStore;
  readonly scripts: () => readonly ScriptInfo[];
  readonly facts: () => GameFacts | null;
  readonly codeDirectory: string;
  readonly dataRoot: string;
  readonly file: DeploymentFile;
  readonly now?: () => Date;
}

interface Failure {
  readonly ok: false;
  readonly error: DeployFailure;
}
export type DeployOutcome = { readonly ok: true; readonly deployment: Deployment } | Failure;
export type PartyOutcome = { readonly ok: true; readonly result: PartyResult } | Failure;
export type ControlAction = 'start' | 'stop' | 'status';
export type { PreviewOutcome } from './preview.ts';

export interface DeployService {
  readonly state: () => Deployments;
  readonly deploy: (character: string, revision: number, prepareOnly: boolean) => Promise<DeployOutcome>;
  readonly deployParty: (revision: number) => Promise<PartyOutcome>;
  readonly control: (character: string, action: ControlAction) => Promise<DeployOutcome>;
  /** What deploying the saved profile would change; read-only, allowed while deployment is locked. */
  readonly preview: (revision: number) => Promise<PreviewOutcome>;
  readonly history: () => Promise<Backup[]>;
  readonly rollback: (id: string) => Promise<DeployOutcome>;
}

const fail = (code: string, detail?: string): Failure => ({ ok: false, error: detail === undefined ? { code } : { code, detail } });

function readySettings(settings: SettingsHolder): Settings | null {
  const state = settings.state();
  return state.status === 'ready' ? state.settings : null;
}

/** Per-character states, written to disk on every change. */
interface Ledger {
  readonly all: () => Readonly<Record<string, Deployment>>;
  readonly update: (name: string, patch: Partial<Deployment>) => Deployment;
  readonly failed: (name: string, error: DeployFailure) => Failure;
}

function createLedger(file: DeploymentFile, now: () => Date): Ledger {
  let deployments = file.read();
  const blank = (): Deployment => ({ stage: 'idle', busy: false, error: null, slot: null, hash: null, profileRevision: null, online: null, codeRunning: null, at: now().toISOString() });
  const update = (name: string, patch: Partial<Deployment>): Deployment => {
    const next: Deployment = { ...(deployments[name] ?? blank()), ...patch, at: now().toISOString() };
    deployments = { ...deployments, [name]: next };
    file.write(deployments);
    return next;
  };
  return {
    all: () => deployments,
    update,
    failed: (name, error) => {
      update(name, { stage: 'failed', busy: false, error });
      return { ok: false, error };
    },
  };
}

interface Context {
  readonly options: DeployServiceOptions;
  readonly ledger: Ledger;
  readonly settings: Settings;
}

type Target = { readonly ok: true; readonly saved: SavedProfile; readonly character: ProfileCharacter } | Failure;

/** The saved profile and the character to deploy, or why it cannot be deployed right now. */
function deployable(saved: SavedProfile | null, name: string, revision: number): Target {
  if (saved === null) {
    return fail('deploy.noProfile');
  }
  if (saved.revision !== revision) {
    return fail('deploy.staleProfile');
  }
  const character = saved.profile.characters.find((entry) => entry.name === name);
  if (character?.enabled !== true) {
    return fail('deploy.characterDisabled', name);
  }
  // caracAL (headless) runs outside the game API; dashboard-v2 keeps handling it until a later card.
  return character.runtime === 'browser' ? { ok: true, saved, character } : fail('deploy.caracalUnsupported', name);
}

/** The bundle with its telemetry reporter, ready to upload. */
async function instrumentedBundle(context: Context, target: { readonly saved: SavedProfile; readonly character: ProfileCharacter }): Promise<{ readonly ok: true; readonly code: string } | Failure> {
  const { options } = context;
  const facts = options.facts();
  if (facts === null) {
    return fail('deploy.noGameData');
  }
  const { saved, character } = target;
  const built = await buildBundle({ profile: saved.profile, character: character.name, scripts: options.scripts(), facts, codeDirectory: options.codeDirectory });
  if (!built.ok) {
    return fail('deploy.buildFailed', built.error);
  }
  return { ok: true, code: withTelemetry(context, built.bundle.code, character.name) };
}

/** Appends a reporter with a fresh ticket (the server keeps only its hash). */
function withTelemetry(context: Context, code: string, name: string): string {
  const { options, settings } = context;
  const { ticket } = options.telemetry.createSession(name);
  const priest = options.profiles.read()?.profile.characters.find((entry) => entry.enabled && entry.ctype === 'priest')?.name ?? '';
  return instrument(code, { endpoint: telemetryEndpoint(settings.dashboard), character: name, ticket, priest, codeDirectory: options.codeDirectory });
}

async function deployOne(context: Context, request: { readonly name: string; readonly revision: number; readonly prepareOnly: boolean }): Promise<DeployOutcome> {
  const { options, ledger } = context;
  const { name } = request;
  const target = deployable(options.profiles.read(), name, request.revision);
  if (!target.ok) {
    return target;
  }
  ledger.update(name, { stage: 'building', busy: true, error: null });
  const bundle = await instrumentedBundle(context, target);
  if (!bundle.ok) {
    return ledger.failed(name, bundle.error);
  }
  const uploaded = await uploadCode({
    client: options.settings.client(), character: name, code: bundle.code, prepareOnly: request.prepareOnly,
    backupDirectory: path.join(options.dataRoot, 'code-backups'),
    progress: (stage) => { ledger.update(name, { stage }); },
  });
  if (!uploaded.ok) {
    return ledger.failed(name, uploaded.error);
  }
  return {
    ok: true,
    deployment: ledger.update(name, {
      stage: uploaded.value.reloadRequested ? 'reloadRequested' : 'prepared', busy: false, error: null, slot: uploaded.value.slot,
      hash: createHash('sha256').update(bundle.code).digest('hex'), profileRevision: target.saved.revision,
    }),
  };
}

async function deployParty(context: Context, revision: number): Promise<PartyOutcome> {
  const saved = context.options.profiles.read();
  if (saved?.revision !== revision) {
    return fail(saved === null ? 'deploy.noProfile' : 'deploy.staleProfile');
  }
  // Farmers first, the merchant last: it starts the others' CODE slots once they exist.
  const order = saved.profile.characters.filter((entry) => entry.enabled).sort((a, b) => Number(a.ctype === 'merchant') - Number(b.ctype === 'merchant'));
  const deployed: string[] = [];
  const failures: { character: string; error: DeployFailure }[] = [];
  for (const character of order) {
    const outcome = await deployOne(context, { name: character.name, revision, prepareOnly: false });
    if (outcome.ok) {
      deployed.push(character.name);
    } else {
      failures.push({ character: character.name, error: outcome.error });
    }
  }
  return { ok: true, result: { deployed, failures } };
}

/** Sends start (with the character's CC_ slot) or stop; null when it was accepted. */
async function sendControl(context: Context, name: string, action: 'start' | 'stop'): Promise<Failure | null> {
  const { ledger } = context;
  const client = context.options.settings.client();
  if (action === 'stop') {
    const stopped = await client.call('browser_code_stop', { character: name });
    if (!stopped.ok) {
      return ledger.failed(name, stopped.error);
    }
    ledger.update(name, { stage: 'stopRequested', error: null });
    return null;
  }
  const found = await findSlot(client, name, false);
  const started = found.ok ? await client.call('browser_code_start', { character: name, slot: found.value.slot }) : found;
  if (!started.ok) {
    return ledger.failed(name, started.error);
  }
  ledger.update(name, { stage: 'startRequested', slot: found.ok ? found.value.slot : null, error: null });
  return null;
}

/** Start or stop the character's CODE, then read back what the game reports. */
async function controlOne(context: Context, name: string, action: ControlAction): Promise<DeployOutcome> {
  const { ledger } = context;
  const refused = action === 'status' ? null : await sendControl(context, name, action);
  if (refused !== null) {
    return refused;
  }
  const client = context.options.settings.client();
  const status = await client.call('browser_code_status', { character: name });
  const parsed = status.ok ? statusSchema.safeParse(status.value) : null;
  if (!status.ok) {
    return ledger.failed(name, status.error);
  }
  return parsed?.success === true
    ? { ok: true, deployment: ledger.update(name, { online: parsed.data.online, codeRunning: parsed.data.code_running, busy: false }) }
    : ledger.failed(name, { code: 'deploy.unexpectedResponse', detail: 'browser_code_status' });
}

/** Restores one backup into its slot with a fresh telemetry ticket; the replaced code is backed up first. */
async function rollbackOne(context: Context, id: string): Promise<DeployOutcome> {
  const { options, ledger } = context;
  const backupDirectory = path.join(options.dataRoot, 'code-backups');
  const backup = await readBackup(backupDirectory, id);
  if (backup === null) {
    return fail('deploy.unknownBackup');
  }
  const name = backup.character;
  ledger.update(name, { stage: 'checking', busy: true, error: null });
  const code = withTelemetry(context, withoutTelemetry(backup.code, name), name);
  const restored = await restoreCode({ client: options.settings.client(), character: name, code, backupDirectory, prepareOnly: false, progress: (stage) => { ledger.update(name, { stage }); } }, backup.slot);
  if (!restored.ok) {
    return ledger.failed(name, restored.error);
  }
  return {
    ok: true,
    deployment: ledger.update(name, { stage: 'rollbackRequested', busy: false, error: null, slot: backup.slot, hash: createHash('sha256').update(code).digest('hex'), profileRevision: null }),
  };
}

export function createDeployService(options: DeployServiceOptions): DeployService {
  const ledger = createLedger(options.file, options.now ?? ((): Date => new Date()));
  let busy = false;

  /** Runs one game operation: refused while deploy is locked or another operation runs. */
  const exclusive = async <T>(work: (context: Context) => Promise<T>): Promise<T | Failure> => {
    const settings = readySettings(options.settings);
    if (settings === null) {
      return fail('deploy.noSettings');
    }
    if (!settings.deploy.enabled) {
      return fail('deploy.disabled');
    }
    if (busy) {
      return fail('deploy.busy');
    }
    busy = true;
    try {
      return await work({ options, ledger, settings });
    } finally {
      busy = false;
    }
  };

  // Save → Preview → Deploy: only the revision last previewed successfully can be deployed.
  let previewed: number | null = null;
  const unlessPreviewed = (revision: number): Failure | null => (previewed === revision ? null : fail('deploy.notPreviewed'));

  return {
    state: () => ({ enabled: readySettings(options.settings)?.deploy.enabled ?? false, characters: ledger.all(), previewedRevision: previewed }),
    deploy: async (name, revision, prepareOnly) => exclusive(async (context) => unlessPreviewed(revision) ?? deployOne(context, { name, revision, prepareOnly })),
    deployParty: async (revision) => exclusive(async (context) => unlessPreviewed(revision) ?? deployParty(context, revision)),
    control: async (name, action) => exclusive(async (context) => controlOne(context, name, action)),
    preview: async (revision) => {
      const outcome = await previewSaved({ saved: options.profiles.read(), facts: options.facts(), scripts: options.scripts(), codeDirectory: options.codeDirectory, client: options.settings.client() }, revision);
      previewed = outcome.ok ? outcome.result.revision : previewed;
      return outcome;
    },
    history: async () => listBackups(path.join(options.dataRoot, 'code-backups')),
    rollback: async (id) => exclusive(async (context) => rollbackOne(context, id)),
  };
}
