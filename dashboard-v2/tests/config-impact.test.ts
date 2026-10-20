import { describe, expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { configurationImpact } from '../src/models/config-impact';
describe('configuration impact', () => {
  it('reports exclusions without treating them as a stop command', () => {
    const saved = initialProfile(scripts()), draft = structuredClone(saved);
    const character = draft.characters.find(row => row.enabled)!;
    character.enabled = false;
    const result = configurationImpact(saved, draft);
    expect(result.characters).toEqual([{ name: character.name, changes: ['enabled'], wasEnabled: true, enabled: false }]);
    expect(result.rebuildCandidates).toEqual([]);
    expect(saved.characters.find(row => row.name === character.name)?.enabled).toBe(true);
  });
  it('includes enabled characters for shared configuration review and reuses cross-board conflicts', () => {
    const saved = initialProfile(scripts()), draft = structuredClone(saved);
    draft.seller.bankDeposit = { enabled: true, items: ['leather'] };
    draft.seller.npcEnabled = true; draft.seller.npcItems = ['leather'];
    const result = configurationImpact(saved, draft);
    expect(result.groups).toContain('seller');
    expect(result.rebuildCandidates).toEqual(draft.characters.filter(row => row.enabled).map(row => row.name));
    expect(result.issues.some(issue => issue.severity === 'error' && issue.message.includes('leather'))).toBe(true);
  });
  it('does not report changes against an identical baseline', () => {
    const saved = initialProfile(scripts());
    expect(configurationImpact(saved, structuredClone(saved))).toMatchObject({ groups: [], characters: [], rebuildCandidates: [] });
  });
});
