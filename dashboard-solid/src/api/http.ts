/**
 * Calls to the local server. Every response is validated with the shared schema before use;
 * writes carry the CSRF token, fetched once per page load.
 */
import { z } from 'zod';
import type { ApiError } from '../../shared/account.ts';
import { apiErrorSchema } from '../../shared/account.ts';

export type ApiResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ApiError };

const errorEnvelopeSchema = z.object({ error: apiErrorSchema });
const sessionSchema = z.object({ csrfToken: z.string() });
let csrfToken: Promise<string> | null = null;

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const envelope = errorEnvelopeSchema.safeParse(body);
    return { ok: false, error: envelope.success ? envelope.data.error : { code: 'http.unexpected', detail: String(response.status) } };
  }
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: { code: 'http.unexpectedResponse' } };
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  try {
    return await parse(await fetch(path, init), schema);
  } catch {
    return { ok: false, error: { code: 'http.unreachable' } };
  }
}

async function getCsrfToken(): Promise<string> {
  csrfToken ??= fetch('/api/session').then(async (response) => sessionSchema.parse(await response.json()).csrfToken);
  return csrfToken;
}

export function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  return request(path, { method: 'GET' }, schema);
}

export interface SendOptions<T> {
  readonly method: 'POST' | 'PUT';
  readonly path: string;
  readonly body: unknown;
  readonly schema: z.ZodType<T>;
}

export async function apiSend<T>({ method, path, body, schema }: SendOptions<T>): Promise<ApiResult<T>> {
  let token: string;
  try {
    token = await getCsrfToken();
  } catch {
    csrfToken = null;
    return { ok: false, error: { code: 'http.unreachable' } };
  }
  return request(path, { method, headers: { 'content-type': 'application/json', 'x-alcc-csrf': token }, body: JSON.stringify(body) }, schema);
}
