/**
 * Golden fixtures for the builder rewrite: runs dashboard-v2's own builder on variants of the current v2 profile and
 * records, per character, the CONFIG, the SHA-256 of the generated code before esbuild, and the warnings.
 *
 * Runs inside dashboard-v2 (its modules and types), never in CI:
 *   pnpm --dir dashboard-v2 exec tsx ../dashboard-solid/tools/golden-v2.mts
 * Reads the profile from the running v2 (GET /api/bootstrap, read-only) and writes
 * dashboard-solid/test/fixtures/builder/*.json. Character names are anonymised. Regenerate when code/ changes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
// @ts-ignore -- dashboard-v2 module, resolved by tsx from the dashboard-v2 working directory.
import { adaptSource, buildBundle, validateProfile } from '../../dashboard-v2/server/builder.ts';
// @ts-ignore
import { initialProfile, scripts, sourceDir } from '../../dashboard-v2/server/scripts.ts';
// @ts-ignore
import { cautiousProfile } from '../../dashboard-v2/shared/onboarding.ts';
// @ts-ignore
import { profileSchema } from '../../dashboard-v2/shared/schema.ts';
// @ts-ignore
import { instrument } from '../../dashboard-v2/server/telemetry.ts';

const V2 = process.env.ALCC_V2_URL ?? 'http://127.0.0.1:9320';
const OUT = path.join(import.meta.dirname, '..', 'test', 'fixtures', 'builder');
const NAMES: Record<string, string> = { Eadroma: 'Hero', Aedroma: 'Healer', Droma: 'Archer', EadroSell: 'Trader', Tonerre: 'Wizard', Dromas: 'Blade' };

function anonymise(value: unknown): any {
  let text = JSON.stringify(value);
  for (const [real, alias] of Object.entries(NAMES)) text = text.split(`"${real}"`).join(`"${alias}"`).split(`"CC_${real}"`).join(`"CC_${alias}"`);
  return JSON.parse(text);
}

type Variant = (p: any) => void;
const variants: Record<string, Variant> = {
  current: () => {},
  'hunts-off': (p) => { p.farming.hunts = false; },
  'rare-visits-off': (p) => { p.farming.rareVisits = false; },
  'expedition-on': (p) => { p.events.enabled = true; p.events.expedition.enabled = true; },
  'events-off': (p) => { p.events.enabled = false; },
  'ponty-off': (p) => { p.seller.ponty.enabled = false; },
  'follow-and-target': (p) => { for (const c of p.characters) if (c.ctype === 'priest') { c.follow = ''; c.farmMonster = 'goo'; } },
  'all-enabled': (p) => { for (const c of p.characters) c.enabled = true; },
  'supervisor-subset': (p) => { p.seller.teamSupervisor.enabled = true; p.seller.teamSupervisor.characters = p.characters.filter((c: any) => c.ctype === 'warrior').map((c: any) => c.name); },
  'daily-dungeon-no-bosses': (p) => { p.farming.dailyDungeon = true; p.farming.bossChecks = { enabled: false, rules: [] }; },
  'stand-and-npc-off': (p) => { p.seller.standEnabled = false; p.seller.npcEnabled = false; p.seller.exchange.enabled = false; },
};

// Builder sections of v2's cautious first profile (everything off): the template of our own cautious profile.
const cautious = cautiousProfile(initialProfile(scripts()));
const sections = { automation: cautious.automation, farming: cautious.farming, events: cautious.events, seller: cautious.seller };
fs.writeFileSync(path.join(import.meta.dirname, '..', 'server', 'profile', 'cautious-sections.json'), `${JSON.stringify(sections, null, 2)}\n`);

const bootstrap = await (await fetch(`${V2}/api/bootstrap`)).json();
const base = anonymise(bootstrap.profile);
const list = scripts();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'catalogue.json'), `${JSON.stringify(list, null, 2)}\n`);
// The game facts v2's validation reads from its catalog.json (derived from G.items and G.craft).
const assets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'dashboard-v2', 'public', 'assets', 'catalog.json'), 'utf8'));
const facts = {
  upgradeable: assets.items.filter((item: any) => item.upgrade).map((item: any) => item.id).sort(),
  compoundable: assets.items.filter((item: any) => item.compound).map((item: any) => item.id).sort(),
  recipes: Object.keys(assets.recipes ?? {}).sort(),
};
fs.writeFileSync(path.join(OUT, 'game-facts.json'), `${JSON.stringify(facts)}\n`);

// Telemetry instrumentation: v2's template with markers in place of the values it inserts, plus one sample to compare.
const inbox = fs.readFileSync(path.join(sourceDir, 'runtime-command-inbox.js'), 'utf8');
const sample = { code: '// bundle', character: 'Hero', ticket: 'a'.repeat(64), port: 9320 };
// The rewrite quotes the priest with JSON.stringify (safe for any name); that is the only intended difference.
const filled = instrument(sample.code, sample.character, sample.ticket, sample.port).replace("get_player('Aedroma')", 'get_player("Aedroma")');
const marked = instrument('', '\u0001CHARACTER\u0001', '\u0001TICKET\u0001', 1)
  .replace(JSON.stringify('http://127.0.0.1:1/api/telemetry'), '__ALCC_ENDPOINT__')
  .replace(JSON.stringify('\u0001TICKET\u0001'), '__ALCC_TICKET__')
  .replace(JSON.stringify('\u0001CHARACTER\u0001'), '__ALCC_CHARACTER__')
  .replace(inbox, '__ALCC_COMMAND_INBOX__')
  .replace("get_player('Aedroma')", 'get_player(__ALCC_PRIEST__)');
for (const marker of ['__ALCC_ENDPOINT__', '__ALCC_TICKET__', '__ALCC_CHARACTER__', '__ALCC_COMMAND_INBOX__', '__ALCC_PRIEST__']) {
  if (marked.split(marker).length !== 2) throw new Error(`marker ${marker} not found exactly once`);
}
fs.writeFileSync(path.join(import.meta.dirname, '..', 'server', 'builder', 'runtime', 'telemetry.js'), marked);
fs.writeFileSync(path.join(OUT, 'telemetry-sample.json'), `${JSON.stringify({ ...sample, sha256: crypto.createHash('sha256').update(filled).digest('hex') })}\n`);
for (const [name, apply] of Object.entries(variants)) {
  const draft = structuredClone(base);
  apply(draft);
  const profile = profileSchema.parse(draft);
  const characters: Record<string, unknown> = {};
  let validation: string | null = null;
  try { validateProfile(profile, list); } catch (error) { validation = String((error as Error).message); }
  for (const character of profile.characters) {
    const script = list.find((entry: any) => entry.id === character.script);
    try {
      const result = adaptSource(fs.readFileSync(path.join(sourceDir, script.filename), 'utf8'), profile, character, script);
      characters[character.name] = { config: result.config, codeSha256: crypto.createHash('sha256').update(result.code).digest('hex'), warnings: result.warnings, bundleSha256: validation === null ? (await buildBundle(profile, character.name)).hash : null };
    } catch (error) {
      characters[character.name] = { error: String((error as Error).message) };
    }
  }
  fs.writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify({ variant: name, v2Revision: bootstrap.version, validation, profile, characters }, null, 2)}\n`);
  console.log(name, Object.keys(characters).length, validation ?? 'valid');
}
