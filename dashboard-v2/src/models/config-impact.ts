import type { Profile } from '../../shared/schema';
import { validateDashboardConfig } from './config-validation';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function configurationImpact(saved: Profile, draft: Profile) {
  const groups = (Object.keys(draft) as Array<keyof Profile>).filter(key => key !== 'characters' && !same(saved[key], draft[key]));
  const names = [...new Set([...saved.characters, ...draft.characters].map(character => character.name))];
  const characters = names.flatMap(name => {
    const before = saved.characters.find(character => character.name === name);
    const after = draft.characters.find(character => character.name === name);
    if (same(before, after)) return [];
    const changes = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(key => !same(before?.[key as keyof typeof before], after?.[key as keyof typeof after]));
    return [{ name, changes, wasEnabled: before?.enabled ?? false, enabled: after?.enabled ?? false }];
  });
  return { groups, characters, issues: validateDashboardConfig(draft).filter(issue => issue.severity !== 'info'),
    rebuildCandidates: groups.length ? draft.characters.filter(character => character.enabled).map(character => character.name) : characters.filter(character => character.enabled).map(character => character.name) };
}
