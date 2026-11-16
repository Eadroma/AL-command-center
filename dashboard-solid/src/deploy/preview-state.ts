/**
 * Deployment preview (on request, for the saved revision), CODE backups, and rollback.
 * Preview never changes anything; rollback is a game action refused by the server while deployment is locked.
 */
import type { Accessor } from 'solid-js';
import { createResource, createSignal } from 'solid-js';
import type { ApiError } from '../../shared/account.ts';
import type { Backup, PreviewResult } from '../../shared/deploy.ts';
import { deploymentSchema, historySchema, previewResultSchema } from '../../shared/deploy.ts';
import { apiGet, apiSend } from '../api/http.ts';

export interface PreviewState {
  readonly result: Accessor<PreviewResult | null>;
  readonly backups: Accessor<readonly Backup[]>;
  readonly busy: Accessor<'previewing' | 'restoring' | null>;
  readonly error: Accessor<ApiError | null>;
  readonly preview: (revision: number) => Promise<void>;
  readonly rollback: (id: string) => Promise<boolean>;
  readonly refreshHistory: () => Promise<void>;
}

export function createPreviewState(): PreviewState {
  const [result, setResult] = createSignal<PreviewResult | null>(null);
  const [busy, setBusy] = createSignal<'previewing' | 'restoring' | null>(null);
  const [error, setError] = createSignal<ApiError | null>(null);
  const [history, { refetch }] = createResource(() => apiGet('/api/deploy/history', historySchema));
  return {
    result,
    backups: () => { const loaded = history(); return loaded?.ok === true ? loaded.value.backups : []; },
    busy,
    error,
    preview: async (revision) => {
      setBusy('previewing');
      setError(null);
      const response = await apiSend({ method: 'POST', path: '/api/deploy/preview', body: { revision }, schema: previewResultSchema });
      setBusy(null);
      setResult(response.ok ? response.value : null);
      setError(response.ok ? null : response.error);
    },
    rollback: async (id) => {
      setBusy('restoring');
      setError(null);
      const response = await apiSend({ method: 'POST', path: '/api/deploy/rollback', body: { id }, schema: deploymentSchema });
      setBusy(null);
      setError(response.ok ? null : response.error);
      await refetch();
      return response.ok;
    },
    refreshHistory: async () => { await refetch(); },
  };
}
