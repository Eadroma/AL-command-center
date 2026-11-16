/**
 * The saved profile and the player's draft, shared by every screen that edits it.
 * Saving sends the draft with the revision it started from; a 409 means another window saved first: the draft is
 * kept so nothing typed is lost, and the player reloads to start from the newer profile.
 */
import type { Accessor } from 'solid-js';
import { createResource, createSignal } from 'solid-js';
import type { ApiError } from '../../shared/account.ts';
import type { SavedProfile } from '../../shared/profile.ts';
import { profileStateSchema, savedProfileSchema } from '../../shared/profile.ts';
import { apiGet, apiSend } from '../api/http.ts';
import type { CharacterPatch, Draft } from './draft.ts';
import { draftOf, isDirty, patchCharacter } from './draft.ts';

export type ProfileBusy = 'saving' | 'creating' | 'importing' | null;

export interface ProfileState {
  /** undefined while loading, null when there is no profile yet. */
  readonly saved: Accessor<SavedProfile | null | undefined>;
  readonly loadError: Accessor<ApiError | null>;
  readonly draft: Accessor<Draft | null>;
  readonly dirty: Accessor<boolean>;
  readonly busy: Accessor<ProfileBusy>;
  readonly error: Accessor<ApiError | null>;
  readonly editCharacter: (name: string, patch: CharacterPatch) => void;
  /** Any other edit of the draft, as a pure function of it (see draft.ts). */
  readonly edit: (change: (draft: Draft) => Draft) => void;
  readonly save: () => Promise<void>;
  readonly discard: () => void;
  readonly reload: () => Promise<void>;
  readonly createCautious: () => Promise<void>;
  readonly importV2: () => Promise<void>;
}

interface RunnerDeps {
  readonly setBusy: (busy: ProfileBusy) => void;
  readonly setError: (error: ApiError | null) => void;
  readonly accept: (saved: SavedProfile) => void;
}

/** Runs one write: marks the profile busy, then keeps the new revision or the error. */
function createRunner(deps: RunnerDeps): (kind: NonNullable<ProfileBusy>, send: () => ReturnType<typeof apiSend<SavedProfile>>) => Promise<void> {
  return async (kind, send) => {
    deps.setBusy(kind);
    const result = await send();
    deps.setBusy(null);
    if (result.ok) {
      deps.accept(result.value);
    } else {
      deps.setError(result.error);
    }
  };
}

export function createProfileState(): ProfileState {
  const [loaded, { refetch, mutate }] = createResource(() => apiGet('/api/profile', profileStateSchema));
  const [edited, setEdited] = createSignal<Draft | null>(null);
  const [busy, setBusy] = createSignal<ProfileBusy>(null);
  const [error, setError] = createSignal<ApiError | null>(null);

  const saved = (): SavedProfile | null | undefined => {
    const result = loaded();
    if (result?.ok !== true) {
      return undefined;
    }
    return result.value.status === 'ready' ? result.value.saved : null;
  };
  const draft = (): Draft | null => {
    const current = saved();
    return edited() ?? (current === null || current === undefined ? null : draftOf(current));
  };
  const accept = (next: SavedProfile): void => {
    mutate({ ok: true, value: { status: 'ready', saved: next } });
    setEdited(null);
    setError(null);
  };
  const run = createRunner({ setBusy, setError, accept });
  const edit = (change: (base: Draft) => Draft): void => {
    const base = draft();
    if (base !== null) {
      setEdited(change(base));
    }
  };
  // Creating and importing name what they replace, like a save: an old window cannot wipe a newer profile.
  const replacing = (): number | null => saved()?.revision ?? null;

  return {
    saved,
    loadError: () => { const result = loaded(); return result?.ok === false ? result.error : null; },
    draft,
    dirty: () => { const current = saved(); const next = edited(); return current !== null && current !== undefined && next !== null && isDirty(next, current); },
    busy,
    error,
    edit,
    editCharacter: (name, patch) => { edit((base) => patchCharacter(base, name, patch)); },
    save: async () => {
      const current = draft();
      if (current !== null) {
        await run('saving', async () => apiSend({ method: 'PUT', path: '/api/profile', body: { revision: current.revision, profile: current.profile }, schema: savedProfileSchema }));
      }
    },
    discard: () => { setEdited(null); setError(null); },
    reload: async () => { setEdited(null); setError(null); await refetch(); },
    createCautious: async () => run('creating', async () => apiSend({ method: 'POST', path: '/api/profile/cautious', body: { revision: replacing() }, schema: savedProfileSchema })),
    importV2: async () => run('importing', async () => apiSend({ method: 'POST', path: '/api/profile/import-v2', body: { revision: replacing() }, schema: savedProfileSchema })),
  };
}
