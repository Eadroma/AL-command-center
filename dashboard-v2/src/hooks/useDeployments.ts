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
    refetchInterval: 3000, // Poll every 3 seconds
  });
}

