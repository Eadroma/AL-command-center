/**
 * Owns the current settings at runtime. Keeps the file's own values apart from the
 * environment overrides, so saving never copies AL_MCP_TOKEN or ALCC_PORT into the file.
 */
import type { Settings, SettingsState, SettingsUpdate } from '../../shared/settings.ts';
import { settingsSchema } from '../../shared/settings.ts';
import type { AccountCheck, ApiError } from '../../shared/account.ts';
import { listCharacters, listServers } from '../mcp/account.ts';
import type { McpClient } from '../mcp/client.ts';
import { applyEnvironment, loadSettings, saveSettings } from './store.ts';

export type CreateClient = (mcpUrl: string, token: string) => McpClient;

export type CheckResult = { readonly ok: true; readonly value: AccountCheck } | { readonly ok: false; readonly error: ApiError };
export type SaveResult =
  | { readonly ok: true; readonly restartRequired: boolean; readonly check: AccountCheck }
  | { readonly ok: false; readonly error: ApiError };

export interface SettingsHolder {
  readonly state: () => SettingsState;
  /** Tests a token (or the saved one when empty) without writing anything. */
  readonly check: (token: string) => Promise<CheckResult>;
  readonly save: (update: SettingsUpdate) => Promise<SaveResult>;
  /** Game API client with the saved token (or AL_MCP_TOKEN); the token stays on the server. */
  readonly client: () => McpClient;
}

const DEFAULT_MCP_URL = 'https://adventure.land/mcp';

export interface HolderOptions {
  readonly file: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly createClient: CreateClient;
  /** Port the server is listening on; a saved port that differs needs a restart. */
  readonly runningPort: () => number;
}

export async function createSettingsHolder(options: HolderOptions): Promise<SettingsHolder> {
  const { file, environment, createClient } = options;
  let fileState = await loadSettings(file);
  const effective = (): SettingsState => (fileState.status === 'ready' ? { ...fileState, settings: applyEnvironment(fileState.settings, environment) } : fileState);
  const saved = (): Settings | null => (fileState.status === 'ready' ? fileState.settings : null);
  const mcpUrl = (): string => saved()?.account.mcpUrl ?? DEFAULT_MCP_URL;

  // AL_MCP_TOKEN counts even before a settings file exists (first launch).
  const storedToken = (): string => {
    const environmentToken = environment['AL_MCP_TOKEN'] ?? '';
    return environmentToken !== '' ? environmentToken : (saved()?.account.mcpToken ?? '');
  };

  const check = async (token: string): Promise<CheckResult> => {
    const client = createClient(mcpUrl(), token !== '' ? token : storedToken());
    const characters = await listCharacters(client);
    if (!characters.ok) {
      return characters;
    }
    const servers = await listServers(client);
    if (!servers.ok) {
      return servers;
    }
    return { ok: true, value: { characters: characters.value, servers: servers.value } };
  };

  const save = async (update: SettingsUpdate): Promise<SaveResult> => {
    const result = await check(update.mcpToken);
    if (!result.ok) {
      return result;
    }
    if (!result.value.servers.some((server) => server.region === update.region && server.name === update.server)) {
      return { ok: false, error: { code: 'settings.unknownServer' } };
    }
    const base = saved();
    const next = settingsSchema.parse({
      ...base,
      version: 1,
      account: { mcpUrl: mcpUrl(), mcpToken: update.mcpToken !== '' ? update.mcpToken : (base?.account.mcpToken ?? '') },
      game: { ...base?.game, region: update.region, server: update.server, runtime: update.runtime },
      dashboard: { ...base?.dashboard, language: update.language, port: update.port },
    });
    const restartRequired = options.runningPort() !== next.dashboard.port;
    await saveSettings(file, next);
    fileState = await loadSettings(file);
    return { ok: true, restartRequired, check: result.value };
  };

  return { state: effective, check, save, client: () => createClient(mcpUrl(), storedToken()) };
}
