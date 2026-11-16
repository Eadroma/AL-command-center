/**
 * Data behind the "To handle" banner: dismissed keys and the game data job state, loaded once and updated
 * after the player acts (dismiss, retry). No polling: character signals come from the live feed.
 */
import type { Accessor } from 'solid-js';
import { createResource } from 'solid-js';
import type { JobState } from '../../../shared/game.ts';
import { dismissedSchema, jobStateSchema } from '../../../shared/game.ts';
import { apiGet, apiSend } from '../../api/http.ts';

export interface AttentionState {
  readonly dismissed: Accessor<ReadonlySet<string>>;
  readonly job: Accessor<JobState | null>;
  readonly dismiss: (key: string) => Promise<void>;
  readonly retryGameData: () => Promise<void>;
}

export function createAttentionState(): AttentionState {
  const [dismissedResult, { mutate: setDismissed }] = createResource(() => apiGet('/api/attention', dismissedSchema));
  const [jobResult, { refetch: refetchJob }] = createResource(() => apiGet('/api/game/job', jobStateSchema));

  return {
    dismissed: () => {
      const result = dismissedResult();
      return new Set(result?.ok === true ? result.value.dismissed : []);
    },
    job: () => {
      const result = jobResult();
      return result?.ok === true ? result.value : null;
    },
    dismiss: async (key) => {
      const result = await apiSend({ method: 'POST', path: '/api/attention/dismiss', body: { key }, schema: dismissedSchema });
      if (result.ok) {
        setDismissed(result);
      }
    },
    retryGameData: async () => {
      await apiSend({ method: 'POST', path: '/api/game/refresh', body: {}, schema: jobStateSchema });
      // The update runs in the background; read its outcome once it had time to finish.
      setTimeout(() => { void refetchJob(); }, 4000);
    },
  };
}
