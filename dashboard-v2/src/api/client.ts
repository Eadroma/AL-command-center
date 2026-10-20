/** JSON transport with explicit HTTP failures and cancellable reads. */
export async function api<T>(
  url: string,
  body?: unknown,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = body !== undefined ? 'POST' : 'GET',
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const payload = data && typeof data === 'object' ? data as Record<string, unknown> : {};
    const message = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  if (data === undefined) throw new Error('The server returned an invalid JSON response.');
  return data as T;
}
