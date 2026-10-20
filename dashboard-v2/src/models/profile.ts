import type { Profile } from '../../shared/schema';

export interface ProfileSnapshot {
  profile: Profile;
  version: number;
  updatedAt: string;
}

export type AutomationKey = 'hunts' | 'rareVisits' | 'events';

/** Update a supported field while preserving every other profile setting. */
export function updateAutomation(profile: Profile, key: AutomationKey, value: boolean): Profile {
  return key === 'events'
    ? { ...profile, events: { ...profile.events, enabled: value } }
    : { ...profile, farming: { ...profile.farming, [key]: value } };
}

export interface ProfileDraft {
  base: ProfileSnapshot;
  profile: Profile;
}

/** Compare with the original revision, never a refreshed remote profile. */
export function isDirty(draft: ProfileDraft | null): boolean {
  return draft !== null && JSON.stringify(draft.profile) !== JSON.stringify(draft.base.profile);
}

/** Update the assigned script for a single character while keeping all other settings intact. */
export function updateCharacterScript(profile: Profile, characterName: string, scriptId: string): Profile {
  return {
    ...profile,
    characters: profile.characters.map(character =>
      character.name === characterName ? { ...character, script: scriptId } : character,
    ),
  };
}
