/**
 * Builder rewrite against dashboard-v2's own output (golden fixtures from tools/golden-v2.mts, anonymised).
 * Uses the sibling ../code folder, like v2's tests; regenerate the fixtures when code/ changes.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { adaptSource } from '../server/builder/adapt-source.ts';
import { buildBundle, instrument, telemetryEndpoint } from '../server/builder/bundle.ts';
import { createCatalogue } from '../server/builder/catalogue.ts';
import { effectiveConfig } from '../server/builder/effective-config.ts';
import { gameFacts } from '../server/builder/facts.ts';
import type { GameFacts } from '../server/builder/validate.ts';
import { validateProfile } from '../server/builder/validate.ts';
import { profileSchema } from '../shared/profile.ts';

const fixtures = path.join(import.meta.dirname, 'fixtures', 'builder');
const codeDirectory = path.resolve(import.meta.dirname, '..', '..', 'code');
const read = (name: string): unknown => JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'));

const goldenSchema = z.object({
  profile: profileSchema,
  characters: z.record(z.string(), z.object({ config: z.unknown().optional(), codeSha256: z.string().optional(), warnings: z.array(z.string()).optional(), error: z.string().optional() })),
});

const REGENERATE = 'pnpm --dir dashboard-v2 exec tsx ../dashboard-solid/tools/golden-v2.mts';
const recordedHashes = new Map(z.array(z.object({ id: z.string(), hash: z.string() }).loose()).parse(read('catalogue.json')).map((script) => [script.id, script.hash]));

/** Scripts edited in code/ since the references were recorded: comparing code with v2 then says nothing. */
const changedScripts = createCatalogue(codeDirectory)().filter((script) => recordedHashes.get(script.id) !== script.hash).map((script) => script.id);
const staleReferences = changedScripts.length > 0 ? `code/ changed since the references (${changedScripts.join(', ')}): run ${REGENERATE}` : false;

describe('script catalogue', () => {
  it('reads the same scripts, CONFIG and hashes as dashboard-v2', () => {
    // One clear failure when code/ moved on; the code comparisons below are skipped with the same reason.
    assert.equal(staleReferences, false);
    const ours: unknown = JSON.parse(JSON.stringify(createCatalogue(codeDirectory)()));
    const expected = read('catalogue.json');
    assert.ok(Array.isArray(ours) && Array.isArray(expected));
    assert.equal(ours.length, expected.length);
    for (const [index, script] of expected.entries()) {
      assert.ok(isDeepStrictEqual(ours[index], script), `script #${String(index)} differs`);
    }
  });
});

const variantFiles = readdirSync(fixtures).filter((file) => !['catalogue.json', 'game-facts.json', 'telemetry-sample.json'].includes(file));

describe('effective CONFIG', () => {
  const catalogue = createCatalogue(codeDirectory);
  for (const file of variantFiles) {
    it(`matches dashboard-v2 for every character (${file})`, () => {
      const fixture = read(file);
      const parsed = goldenSchema.parse(fixture);
      for (const character of parsed.profile.characters) {
        const script = catalogue().find((entry) => entry.id === character.script);
        assert.ok(script !== undefined, character.script);
        const expected = parsed.characters[character.name];
        const ours: unknown = JSON.parse(JSON.stringify(effectiveConfig(parsed.profile, character, script)));
        assert.equal(JSON.stringify(ours), JSON.stringify(expected?.config), `${file}: ${character.name}`);
      }
    });
  }
});

describe('adapted source', { skip: staleReferences }, () => {
  const catalogue = createCatalogue(codeDirectory);
  for (const file of variantFiles) {
    it(`produces dashboard-v2's exact code and warnings (${file})`, () => {
      const parsed = goldenSchema.parse(read(file));
      for (const character of parsed.profile.characters) {
        const script = catalogue().find((entry) => entry.id === character.script);
        assert.ok(script !== undefined, character.script);
        const expected = parsed.characters[character.name];
        const source = readFileSync(path.join(codeDirectory, script.filename), 'utf8');
        const result = adaptSource({ source, profile: parsed.profile, character, script, codeDirectory });
        assert.equal(createHash('sha256').update(result.code).digest('hex'), expected?.codeSha256, `${file}: ${character.name} code`);
        assert.deepEqual(result.warnings, expected?.warnings, `${file}: ${character.name} warnings`);
      }
    });
  }
});

const factsSchema = z.object({ upgradeable: z.array(z.string()), compoundable: z.array(z.string()), recipes: z.array(z.string()) });

describe('profile validation', () => {
  const catalogue = createCatalogue(codeDirectory);
  const lists = factsSchema.parse(read('game-facts.json'));
  const facts: GameFacts = {
    upgradeable: (item) => lists.upgradeable.includes(item),
    compoundable: (item) => lists.compoundable.includes(item),
    hasRecipe: (item) => lists.recipes.includes(item),
  };
  for (const file of variantFiles) {
    it(`accepts or refuses like dashboard-v2 (${file})`, () => {
      const fixture = z.object({ validation: z.string().nullable(), profile: profileSchema }).parse(read(file));
      assert.equal(validateProfile(fixture.profile, catalogue(), facts), fixture.validation);
    });
  }

  it('refuses a profile without the builder sections, a managed override and a misshaped one', () => {
    const fixture = goldenSchema.parse(read('current.json'));
    const withoutSeller = profileSchema.parse(Object.fromEntries(Object.entries(fixture.profile).filter(([key]) => key !== 'seller')));
    assert.equal(validateProfile(withoutSeller, catalogue(), facts), 'The profile has no seller section yet: import it from dashboard v2.');
    const [first, ...rest] = fixture.profile.characters;
    assert.ok(first !== undefined);
    const withOverride = (overrides: Record<string, unknown>): string | null => validateProfile({ ...fixture.profile, characters: [{ ...first, overrides }, ...rest] }, catalogue(), facts);
    assert.equal(withOverride({ NAME: 'x' }), 'NAME is managed by the party controls.');
    assert.equal(withOverride({ NOPE: 1 }), `Unknown setting NOPE in ${first.script}.js.`);
  });
});

describe('bundle and telemetry', { skip: staleReferences }, () => {
  const catalogue = createCatalogue(codeDirectory);
  const lists = factsSchema.parse(read('game-facts.json'));
  const facts: GameFacts = {
    upgradeable: (item) => lists.upgradeable.includes(item),
    compoundable: (item) => lists.compoundable.includes(item),
    hasRecipe: (item) => lists.recipes.includes(item),
  };
  const bundleSchema = z.object({ profile: profileSchema, characters: z.record(z.string(), z.object({ bundleSha256: z.string().nullable() })) });

  it('compiles the same ES2017 bundles as dashboard-v2', async () => {
    for (const file of ['current.json', 'expedition-on.json', 'stand-and-npc-off.json']) {
      const fixture = bundleSchema.parse(read(file));
      for (const character of fixture.profile.characters) {
        const result = await buildBundle({ profile: fixture.profile, character: character.name, scripts: catalogue(), facts, codeDirectory });
        assert.ok(result.ok, result.ok ? '' : result.error);
        assert.equal(result.bundle.hash, fixture.characters[character.name]?.bundleSha256, `${file}: ${character.name}`);
        assert.equal(result.bundle.filename, `${character.name}.${character.runtime}.js`);
      }
    }
  });

  it('refuses to build an invalid profile with v2\'s message', async () => {
    const fixture = bundleSchema.parse(read('all-enabled.json'));
    const result = await buildBundle({ profile: fixture.profile, character: 'Hero', scripts: catalogue(), facts, codeDirectory });
    assert.deepEqual(result, { ok: false, error: 'Automation requires a v2 farmer script for Wizard.' });
  });

  it('adds the same telemetry as dashboard-v2, with a configurable address and priest', () => {
    const sample = z.object({ code: z.string(), character: z.string(), ticket: z.string(), port: z.number(), sha256: z.string() }).parse(read('telemetry-sample.json'));
    const target = { endpoint: `http://127.0.0.1:${String(sample.port)}/api/telemetry`, character: sample.character, ticket: sample.ticket, priest: 'Aedroma', codeDirectory };
    assert.equal(createHash('sha256').update(instrument(sample.code, target)).digest('hex'), sample.sha256);
    const hosted = instrument('', { ...target, endpoint: telemetryEndpoint({ publicUrl: 'https://alcc.example.org', port: 9321 }), priest: 'Healer' });
    assert.ok(hosted.includes('"https://alcc.example.org/api/telemetry"') && hosted.includes('get_player("Healer")') && !hosted.includes('__ALCC_'));
    assert.equal(telemetryEndpoint({ publicUrl: '', port: 9321 }), 'http://127.0.0.1:9321/api/telemetry');
  });
});

describe('game facts', () => {
  it('reads upgrade, compound and recipes from G', () => {
    const facts = gameFacts({
      version: 1, monsters: {}, maps: {}, classes: {}, imagesets: {}, positions: {}, sprites: {}, tilesets: {},
      items: { blade: { name: 'Blade', upgrade: { gold: 1 } }, ringsj: { name: 'Ring', compound: { gold: 1 } }, hpot1: { name: 'Potion' } },
      craft: { wingedboots: { items: [] } },
    });
    assert.deepEqual([facts.upgradeable('blade'), facts.upgradeable('hpot1'), facts.compoundable('ringsj'), facts.hasRecipe('wingedboots'), facts.hasRecipe('constructor')], [true, false, true, true, false]);
  });
});
