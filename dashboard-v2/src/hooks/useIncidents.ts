import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { IncidentResolutionsResponse } from '../types';

export function useIncidentResolutions() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['incident-resolutions'],
    queryFn: ({ signal }) => api<IncidentResolutionsResponse>('/api/incidents/resolutions', undefined, 'GET', signal),
  });
  const mutation = useMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) => api<IncidentResolutionsResponse>('/api/incidents/resolutions', { id, resolved }),
    onSuccess: data => client.setQueryData(['incident-resolutions'], data),
  });
  return { resolutions: query.data?.resolutions ?? {}, loading: query.isLoading, error: query.error?.message || mutation.error?.message, pendingId: mutation.variables && mutation.isPending ? mutation.variables.id : null, setResolved: (id: string, resolved: boolean) => mutation.mutate({ id, resolved }) };
}
