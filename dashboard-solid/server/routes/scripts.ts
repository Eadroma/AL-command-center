/** GET /api/scripts: the script catalogue without source, for screens that explain targets and scripts. */
import type { Hono } from 'hono';
import type { ScriptsResponse } from '../../shared/scripts.ts';
import type { ScriptInfo } from '../builder/catalogue.ts';
import { field, isRecord, text } from '../../shared/raw.ts';

/** The warrior's single-target picks (WEAPONS.pack entries set to fireblade), as dashboard-v2 seeds styles. */
function monoTargets(scripts: readonly ScriptInfo[]): string[] {
  const warrior = scripts.find((script) => script.id === 'eadroma-warrior-v2') ?? scripts.find((script) => script.ctype === 'warrior');
  const pack = field(warrior?.config['WEAPONS'], 'pack');
  return isRecord(pack) ? Object.entries(pack).filter(([, weapon]) => weapon === 'fireblade').map(([monster]) => monster) : [];
}

export function scriptsResponse(scripts: readonly ScriptInfo[]): ScriptsResponse {
  return {
    scripts: scripts.map((script) => ({
      id: script.id, label: script.label, ctype: script.ctype, kind: script.kind,
      fixedFarm: script.config['FIXED_FARM'] === true ? text(script.config['DEFAULT_FARM']) : null,
    })),
    monoTargets: monoTargets(scripts),
  };
}

export function scriptRoutes(app: Hono, scripts: () => readonly ScriptInfo[]): void {
  app.get('/api/scripts', (context) => context.json(scriptsResponse(scripts())));
}
