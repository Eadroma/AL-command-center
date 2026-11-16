import { expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { sourceDir, ast } from '../server/scripts';

const source = fs.readFileSync(path.join(sourceDir, 'eadrosell-merchant-v2.js'), 'utf8');
const pick = (names: string[]) => ast(source).body.filter((n: any) => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map((n: any) => source.slice(n.start, n.end)).join('\n');

it('never restarts a farmer that runs in its own window and reported in the last five minutes', () => {
  let t = 1_000_000;
  const c: any = { Date: { now: () => t }, farmer_reports: {}, get_active_characters: () => ({ EadroSell: 'self', Eadroma: 'code' }), get_player: () => null, parent: {} };
  vm.createContext(c);
  vm.runInContext(pick(['team_child_running', 'team_child_state', 'fresh_farmer_report']), c);
  c.farmer_reports.Dromas = { at: t };
  t += 90_000; // merchant busy upgrading: report older than 60 s
  expect(c.team_child_running('Dromas')).toBe(true);
  t += 300_000; // silent for more than 5 min: really gone
  expect(c.team_child_running('Dromas')).toBe(false);
  expect(c.team_child_running('Eadroma')).toBe(true); // a child of this client is seen directly
});
