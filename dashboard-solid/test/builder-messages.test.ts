/** Every builder message (dashboard-v2's English) is recognised and shown in the current language. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { builderMessage } from '../src/deploy/builder-messages.ts';
import { setLocale } from '../src/i18n/i18n.ts';

const fixtures = path.join(import.meta.dirname, 'fixtures', 'builder');
const fixtureSchema = z.object({ validation: z.string().nullable(), characters: z.record(z.string(), z.object({ warnings: z.array(z.string()).optional() })) });

/** Messages the fixtures do not happen to contain, one per remaining builder rule. */
const OTHERS = [
  'The profile has no seller section yet: import it from dashboard v2.', 'Missing script: x', 'Eadroma · Warrior · V2 is not compatible with Hero.',
  'Crypt scripts do not support upgrade/combine jobs.', 'Unknown setting NOPE in a.js.', 'NAME is managed by the party controls.', 'KITE must be boolean.',
  'HP_RATIO must be between 0 and 1.', 'Invalid setting key __proto__', 'Commercial objectives require an enabled v2 merchant.', 'No craft recipe for x.',
  'Commercial goal x conflicts with exchange, upgrade, listing or deposit rules. Keep production outputs until completion.',
  'x cannot be upgraded (not an upgradeable item type).', 'x cannot be compounded.', 'x cannot be both exchanged at Xyn and listed on the player stand.',
  'x +3 is below its upgrade target; list it at the target level or above.', 'x +0 cannot be both a stand buy order and a sell listing.',
  'x is also in PONTY_ITEMS — Ponty tours may still buy more of it.', 'x is on both Gabriel and Xyn lists — exchange wins; NPC sales skip it.',
  'x is on both Gabriel and upgrade lists — upgrade wins; NPC sales skip it.', 'x is reserved for the stand — NPC sales will skip matching levels.',
  'x is bought from Ponty and also listed on the stand — intentional but watch stock.', 'Merchant team auto-start is paused.',
  'No farmer TEAM_SLOTS configured — enable farmers so the merchant can start them.', 'Crypt retains its own target and route; global open-world farming/event controls do not apply.',
  'Stand-sell uses its own merchant/item settings; party seller rules do not apply.', 'Unknown character.',
];

function fixtureMessages(): string[] {
  return readdirSync(fixtures).filter((file) => !['catalogue.json', 'game-facts.json', 'telemetry-sample.json'].includes(file)).flatMap((file) => {
    const fixture = fixtureSchema.parse(JSON.parse(readFileSync(path.join(fixtures, file), 'utf8')));
    return [...(fixture.validation === null ? [] : [fixture.validation]), ...Object.values(fixture.characters).flatMap((character) => character.warnings ?? [])];
  });
}

describe('builder messages', () => {
  it('translates every message the builder produces, in both languages', () => {
    const messages = [...new Set([...fixtureMessages(), ...OTHERS])];
    assert.ok(messages.length > 30);
    for (const locale of ['fr', 'en'] as const) {
      setLocale(locale);
      const untranslated = messages.filter((message) => builderMessage(message) === message || builderMessage(message).includes('undefined'));
      assert.deepEqual(untranslated, [], locale);
    }
  });

  it('keeps an unknown message as sent and fills the parameters', () => {
    setLocale('fr');
    assert.equal(builderMessage('Something new.'), 'Something new.');
    assert.equal(builderMessage('Automation requires a v2 farmer script for Wizard.'), 'Les automatisations demandent un script v2 pour Wizard.');
    assert.equal(builderMessage('Merchant will start_character Hero + Healer into their CC_* CODE slots when they are not already running.'), 'Le marchand démarre Hero, Healer dans leurs emplacements CC_ quand ils ne tournent pas.');
  });
});
