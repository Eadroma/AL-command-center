import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBootstrap } from './useBootstrap';
import { useDeployments } from './useDeployments';
import { useLiveFeed } from './useLiveFeed';
import { mapParty, mapActivity } from '../models/party';

/** Compose server queries without mixing profile drafts into runtime telemetry. */
export function usePartyState() {
  const client = useQueryClient();
  const { connected } = useLiveFeed();
  const bootstrap = useBootstrap();
  const deployments = useDeployments();
  const [clearedThrough, setClearedThrough] = useState(0);
  const logs = mapActivity(bootstrap.data?.activity ?? []);
  return {
    connected,
    loading: bootstrap.isLoading,
    error: bootstrap.error?.message ?? deployments.error?.message,
    snapshot: bootstrap.data,
    deployments: deployments.data,
    partyMembers: bootstrap.data
      ? mapParty(bootstrap.data.profile, deployments.isError ? {} : deployments.data?.characters ?? {})
      : null,
    logs: logs.filter(entry => entry.id > clearedThrough),
    clearLogs: () => setClearedThrough(Math.max(clearedThrough, ...logs.map(entry => entry.id))),
    deploymentBusy: Object.values(deployments.data?.characters ?? {}).some(entry => entry.busy),
    refreshAll: () => {
      void client.invalidateQueries({ queryKey: ['bootstrap'] });
      void client.invalidateQueries({ queryKey: ['deployments'] });
    },
  };
}
