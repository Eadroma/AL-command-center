/** Pure helpers for the Settings form (tested without a browser). */
import type { GameServer } from '../../../shared/account.ts';
import type { SettingsResponse, SettingsUpdate } from '../../../shared/settings.ts';

export type SettingsForm = SettingsUpdate;

/** Starting values: the saved settings when there are some, sensible defaults otherwise. */
export function initialForm(response: SettingsResponse): SettingsForm {
  if (response.status === 'ready') {
    const saved = response.settings;
    return { mcpToken: '', region: saved.region, server: saved.server, runtime: saved.runtime, language: saved.language, port: saved.port };
  }
  return { mcpToken: '', region: 'EU', server: 'I', runtime: 'browser', language: 'fr', port: 9320 };
}

/** Regions in the order the game lists them, without duplicates. */
export function regionsOf(servers: readonly GameServer[]): string[] {
  return [...new Set(servers.map((server) => server.region))];
}

export function serversIn(servers: readonly GameServer[], region: string): GameServer[] {
  return servers.filter((server) => server.region === region);
}

/** Keeps the chosen server when it exists, otherwise the first online one of the region, otherwise the first one. */
export function pickServer(servers: readonly GameServer[], form: Pick<SettingsForm, 'region' | 'server'>): Pick<SettingsForm, 'region' | 'server'> {
  if (servers.some((server) => server.region === form.region && server.name === form.server)) {
    return form;
  }
  const inRegion = serversIn(servers, form.region);
  const candidate = inRegion.find((server) => server.online) ?? inRegion[0] ?? servers.find((server) => server.online) ?? servers[0];
  return candidate === undefined ? form : { region: candidate.region, server: candidate.name };
}
