import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { OperationsHistoryResponse } from '../types/operations';

export function useOperationsHistory(hours = 168) {
  return useQuery({
    queryKey: ['operations-history', hours],
    queryFn: ({ signal }) => api<OperationsHistoryResponse>(`/api/operations?hours=${hours}`, undefined, 'GET', signal),
    refetchInterval: 15_000,
  });
}
