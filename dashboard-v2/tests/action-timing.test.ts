import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { sourceDir } from '../server/scripts';

describe('ping-aware action timing', () => {
  it('uses the lowest observed ping, bounds correction and schedules from the corrected cooldown', () => {
    let now = 1_000;
    const reduce = vi.fn((skill: string, amount: number) => {
      expect(skill).toBe('attack');
      context.parent.next_skill.attack = new Date(context.parent.next_skill.attack.getTime() - amount);
    });
    const context: any = {
      character: { ping: 90 },
      parent: { pings: [70, 40, 110], next_skill: { attack: new Date(1_500) } },
      reduce_cooldown: reduce,
      Date: { now: () => now },
      isFinite,
    };
    vm.runInNewContext(fs.readFileSync(path.join(sourceDir, 'action-timing.js'), 'utf8'), context);
    expect(context.ActionTiming.ping()).toBe(40);
    expect(context.ActionTiming.after('attack', 50, 20)).toBe(466);
    expect(reduce).toHaveBeenCalledWith('attack', 34);
    now = 2_000;
    expect(context.ActionTiming.next('attack', 50, 20)).toBe(50);
  });
});
