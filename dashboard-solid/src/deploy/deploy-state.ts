/**
 * Deployment state of every character and the start / stop / status controls, shared by the Team screen.
 * The server refuses any game action while deploy.enabled is false; the UI shows why instead of hiding the buttons.
 */
import type { Accessor } from 'solid-js';
import { createResource, createSignal } from 'solid-js';
import type { ApiError } from '../../shared/account.ts';
import type { Deployment, Deployments, PartyResult } from '../../shared/deploy.ts';
import { deploymentSchema, deploymentsSchema, partyResultSchema } from '../../shared/deploy.ts';
import { apiGet, apiSend } from '../api/http.ts';

export type ControlAction = 'start' | 'stop' | 'status';

export interface DeployState {
  readonly deployments: Accessor<Deployments | null>;
  readonly of: (name: string) => Deployment | null;
  /** Character whose control request is in flight. */
  readonly pending: Accessor<string | null>;
  readonly error: Accessor<{ readonly character: string; readonly error: ApiError } | null>;
  readonly control: (character: string, action: ControlAction) => Promise<void>;
  /** Re-reads the states (after a preview, the previewed revision changes). */
  readonly refresh: () => Promise<void>;
  readonly deploying: Accessor<boolean>;
  /** Last team deployment: who was deployed, and who failed with why. */
  readonly party: Accessor<PartyResult | null>;
  readonly partyError: Accessor<ApiError | null>;
  readonly deployParty: (revision: number) => Promise<void>;
}

export function createDeployState(): DeployState {
  const [loaded, { refetch }] = createResource(() => apiGet('/api/deployments', deploymentsSchema));
  const [pending, setPending] = createSignal<string | null>(null);
  const [error, setError] = createSignal<{ readonly character: string; readonly error: ApiError } | null>(null);
  const [deploying, setDeploying] = createSignal(false);
  const [party, setParty] = createSignal<PartyResult | null>(null);
  const [partyError, setPartyError] = createSignal<ApiError | null>(null);
  const deployments = (): Deployments | null => { const result = loaded(); return result?.ok === true ? result.value : null; };
  return {
    deployments,
    of: (name) => deployments()?.characters[name] ?? null,
    pending,
    error,
    control: async (character, action) => {
      setPending(character);
      setError(null);
      const result = await apiSend({ method: 'POST', path: '/api/control', body: { character, action }, schema: deploymentSchema });
      setPending(null);
      if (!result.ok) {
        setError({ character, error: result.error });
      }
      // The server records failures too: read back the states either way.
      await refetch();
    },
    refresh: async () => { await refetch(); },
    deploying,
    party,
    partyError,
    deployParty: async (revision) => {
      setDeploying(true);
      setParty(null);
      setPartyError(null);
      const result = await apiSend({ method: 'POST', path: '/api/deploy/party', body: { revision }, schema: partyResultSchema });
      setDeploying(false);
      setParty(result.ok ? result.value : null);
      setPartyError(result.ok ? null : result.error);
      await refetch();
    },
  };
}
