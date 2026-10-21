/**
 * @file useDeployments.ts
 * React Query hook for polling character deployment statuses and fleet health.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { DeploymentsResponse } from '../types/deployments';

export function useDeployments() {
  return useQuery({
    queryKey: ['deployments'],
    queryFn: ({ signal }) => api<DeploymentsResponse>('/api/deployments', undefined, 'GET', signal),
    // The /live socket pushes refreshes on telemetry and changes; polling is only a fallback (e.g. liveness expiry).
    refetchInterval: 15_000,
  });
}

