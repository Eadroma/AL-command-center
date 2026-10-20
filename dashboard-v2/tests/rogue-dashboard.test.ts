import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { classSkills, profileSchema } from '../shared/schema';
import { scripts, initialProfile, ast } from '../server/scripts';
import { buildBundle, effectiveConfig, validateProfile } from '../server/builder';
import { instrument } from '../server/telemetry';
import { applyTeamComposition } from '../src/models/team-composition';

function profile() {
  const list = scripts();
  const p = initialProfile(list);
  p.characters.find(c => c.name === 'Droma')!.enabled = false;
  p.characters.push({ name: 'Dromas', ctype: 'rogue', enabled: true, runtime: 'browser', script: 'dromas-rogue-v2', follow: '', events: false, job: 'hunt', farmMonster: 'crab', overrides: {} });
  p.seller.teamSupervisor = { enabled: true, characters: ['Dromas'], soloGuard: true };
  p.seller.consumables.rules.push({ character: 'Dromas', item: 'elixirluck', minQty: 1, targetQty: 1, maxQty: 1, mode: 'elixir', source: 'mule' });
  p.automation.combatGear.push({ character: 'Dromas', enabled: true, combatItem: 'handofmidas', combatMinLevel: 0, movementItem: 'gloves', movementMinLevel: 0 });
  return { p, list };
}

describe('native rogue dashboard', () => {
  it('keeps the enabled rogue as DPS when staging the full team', () => {
    const { p } = profile();
    const team = applyTeamComposition(p, 'team', 'Dromas');
    expect(team.characters.find(c => c.name === 'Dromas')?.enabled).toBe(true);
    expect(team.characters.find(c => c.name === 'Droma')?.enabled).toBe(false);
    expect(team.seller.teamSupervisor.characters).toContain('Dromas');
  });
  it('recognizes the rogue class, script and skill controls and starts its native slot', () => {
    const { p, list } = profile();
    expect(profileSchema.safeParse(p).success).toBe(true);
    expect(() => validateProfile(p, list)).not.toThrow();
    expect(list.find(s => s.id === 'dromas-rogue-v2')).toMatchObject({ ctype: 'rogue', kind: 'farm' });
    expect(list.some(s => s.id === 'dromas-rogue')).toBe(false);
    expect(classSkills.rogue.map(s => s.id)).toEqual(['fanofknives', 'mentalburst', 'rspeed']);
    const merchant = p.characters.find(c => c.name === 'EadroSell')!;
    const cfg = effectiveConfig(p, merchant, list.find(s => s.id === merchant.script)!) as any;
    expect(cfg.TEAM_SLOTS).toEqual({ Dromas: 'CC_Dromas' });
    expect(cfg.FARMERS).toContain('Dromas');
    expect(cfg.FARMERS).not.toContain('Droma');
  });
  it('builds a parseable deployment with telemetry, gear, safety and consumable integration', async () => {
    const { p } = profile();
    const built = await buildBundle(p, 'Dromas');
    expect(() => ast(instrument(built.code, 'Dromas', 'test-ticket', 9320))).not.toThrow();
    expect(built.config).toMatchObject({ NAME: 'Dromas', DEFAULT_FARM: 'crab', FIXED_FARM: true, FARM_INDEPENDENT: true, MERCHANT: 'EadroSell', merchantSpot: p.seller.standSpot });
    expect(built.code).toContain('RuntimePolicy.install()');
    expect(built.code).toContain('CombatGear.install()');
    expect(built.code).toContain('MovementWatchdog');
    expect(built.code).toContain('wear_dashboard_kit');
    expect(built.code).toContain('dashboard_elixir_rule');
    expect(/load_code\(["']gui["']/.test(built.code)).toBe(true);
  });
  it('honors disabled skills, configured consumables and policy holds in the native runtime', async () => {
    const code = fs.readFileSync(new URL('../../code/dromas-rogue-v2.js', import.meta.url), 'utf8').replace('CrabRogue.install();', 'CrabRogue;');
    const casts: string[] = [], routes: any[] = [];
    const c: any = {
      __ALCC: { kit: { enabled: false } },
      character: { name: 'Dromas', map: 'main', x: -1200, y: -70, hp: 100, max_hp: 100, mp: 1000, level: 70, int: 100, items: [], esize: 20, slots: { belt: { name: 'knifebelt' } } },
      parent: { entities: { m: { id: 'm', mtype: 'crab', type: 'monster', hp: 100, x: -1190, y: -70 } } },
      G: { skills: { fanofknives: { level: 65, mp: 180, range: 160 }, mentalburst: { mp: 180, range: 100 } } },
      is_disabled: () => false, is_on_cooldown: () => false, can_attack: () => false,
      StyleLoadout: { allows: () => false }, RuntimePolicy: { allowTarget: () => false, allowLoop: () => false },
      use_skill: async (name: string) => casts.push(name), smart_move: async (d: any) => routes.push(d),
      dashboard_elixir_rule: () => null,
    };
    const runtime = vm.runInNewContext(code, c);
    await runtime.combat(); await runtime.movement(); await runtime.liquidLuck();
    expect(casts).toEqual([]); expect(routes).toEqual([]);
    c.RuntimePolicy.allowTarget = () => true;
    await runtime.combat(); expect(casts).toEqual([]);
  });
});
