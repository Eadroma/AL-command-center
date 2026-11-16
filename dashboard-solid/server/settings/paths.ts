/**
 * Where ALCC keeps its settings and data: the operating system's application folder,
 * never the code folder, so the MCP token is not copied along with the project.
 */
import os from 'node:os';
import path from 'node:path';

export function appDirectory(environment: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string {
  const home = os.homedir();
  switch (platform) {
    case 'win32':
      return path.join(environment['LOCALAPPDATA'] ?? path.join(home, 'AppData', 'Local'), 'ALCC');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'ALCC');
    default:
      return path.join(environment['XDG_DATA_HOME'] ?? path.join(home, '.local', 'share'), 'alcc');
  }
}

/** Where data lives: `dashboard.dataDirectory` when set, otherwise the application folder. */
export function dataRootFor(settings: { readonly dashboard: { readonly dataDirectory: string } } | null, environment: NodeJS.ProcessEnv): string {
  const configured = settings?.dashboard.dataDirectory ?? '';
  return configured === '' ? appDirectory(environment) : configured;
}

/** `ALCC_SETTINGS` wins; otherwise settings.json in the application folder. */
export function settingsFile(environment: NodeJS.ProcessEnv, platform: NodeJS.Platform = process.platform): string {
  const override = environment['ALCC_SETTINGS'];
  return override !== undefined && override !== '' ? path.resolve(override) : path.join(appDirectory(environment, platform), 'settings.json');
}
