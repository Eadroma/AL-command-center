/**
 * @file useBootstrap.ts
 * React Query hook for initial profile bootstrap and game catalog data.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Profile, Catalog, Activity } from '../../shared/schema';

export interface BootstrapResponse {
  profile: Profile;
  version: number;
  updatedAt: string;
  catalog: Catalog;
  managedKeys: string[];
  activity: Activity[];
  runtime: {
    browser: string;
    caracal: string;
    mainframe: string;
  };
}

export function useBootstrap() {
  return useQuery({
    queryKey: ['bootstrap'],
    queryFn: ({ signal }) => api<BootstrapResponse>('/api/bootstrap', undefined, 'GET', signal),
  });
}

