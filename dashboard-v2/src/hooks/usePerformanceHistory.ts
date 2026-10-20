import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PerformanceHistoryResponse } from '../types';

export function usePerformanceHistory(hours: number) {
  return useQuery({
    queryKey: ['performance-history', hours],
    queryFn: ({ signal }) => api<PerformanceHistoryResponse>(`/api/performance?hours=${hours}`, undefined, 'GET', signal),
    refetchInterval: 60_000,
  });
}
