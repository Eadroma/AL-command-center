import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('ranger combat acknowledgements', () => {
  for (const script of ['droma-ranger-v2.js', 'droma-ranger-crab-aoe-v2.js']) {
    it(`${script}: continues attacking when huntersmark succeeds without resolving its promise`, async () => {
      vi.useFakeTimers();
      const target: any = { max_hp: 1_000_000, s: {} };
      const attack = vi.fn(async () => ({ success: true }));
      const context: any = {
        character: { mp: 1000, rip: false }, state: {}, cache: { target },
        CONFIG: { skills: { huntersmarkEnabled: true, huntersmarkMinHp: 100 } },
        updateCache: () => {}, is_disabled: () => false, is_in_range: () => true,
        is_on_cooldown: () => false, can_attack: () => true, attack,
        use_skill: () => {
          target.s.marked = { ms: 10_000 };
          context.parent.next_skill.huntersmark = new Date(Date.now() + 10_000);
          return new Promise(() => {});
        },
        parent: { next_skill: {} }, Date, Math, Number, isFinite, Promise,
        setTimeout, clearTimeout,
      };
      vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'action-timing.js'), 'utf8'), context);
      const source = fs.readFileSync(path.join(sourceDir, script), 'utf8');
      vm.runInNewContext(source.slice(source.indexOf('async function combatLoop()'), source.indexOf('async function supportLoop()')), context);
      const first = context.combatLoop();
      await vi.advanceTimersByTimeAsync(400);
      await first;
      await vi.advanceTimersByTimeAsync(150);
      expect(attack).toHaveBeenCalledTimes(1);
    });
  }
});
