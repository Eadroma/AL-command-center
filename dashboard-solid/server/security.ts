/**
 * Local-mode guards. The server listens on 127.0.0.1, but any web page open in the browser can still
 * send it requests; these checks stop such pages from reading or changing anything:
 * - Host must be a loopback name (blocks DNS rebinding).
 * - Every write needs the per-process CSRF token (only same-origin pages can read it) and,
 *   when the browser sends one, a loopback Origin.
 * - The telemetry route is the one exception: game scripts post to it from https://adventure.land,
 *   so it accepts that origin with CORS and relies on its own ticket check instead of the CSRF token.
 */
import { randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

export const CSRF_HEADER = 'x-alcc-csrf';
export const TELEMETRY_PATH = '/api/telemetry';
export const GAME_ORIGIN = 'https://adventure.land';

const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hostname of a Host header, without its port. */
export function hostnameOf(hostHeader: string | undefined): string {
  if (hostHeader === undefined) {
    return '';
  }
  return hostHeader.startsWith('[') ? hostHeader.slice(0, hostHeader.indexOf(']') + 1) : hostHeader.replace(/:\d+$/, '');
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    return loopbackHosts.has(new URL(origin).hostname); // WHATWG keeps the brackets: "[::1]"
  } catch {
    return false;
  }
}

function setTelemetryCors(headers: Headers): void {
  headers.set('access-control-allow-origin', GAME_ORIGIN);
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('vary', 'Origin');
}

/** Refusal code for a request, or null when it may proceed. */
type GuardCode = 'http.forbiddenHost' | 'http.forbiddenOrigin' | 'http.invalidCsrf' | null;

interface GuardedRequest {
  readonly host: string | undefined;
  readonly origin: string | undefined;
  readonly method: string;
  readonly path: string;
  readonly csrf: string | undefined;
}

/** Pure decision, kept apart from Hono so each rule reads on its own. */
export function checkRequest(request: GuardedRequest, csrfToken: string): GuardCode {
  if (!loopbackHosts.has(hostnameOf(request.host))) {
    return 'http.forbiddenHost';
  }
  const { origin } = request;
  if (request.path === TELEMETRY_PATH) {
    return origin === undefined || origin === GAME_ORIGIN || isLoopbackOrigin(origin) ? null : 'http.forbiddenOrigin';
  }
  if (safeMethods.has(request.method)) {
    return null;
  }
  if (origin !== undefined && !isLoopbackOrigin(origin)) {
    return 'http.forbiddenOrigin';
  }
  return request.csrf === csrfToken ? null : 'http.invalidCsrf';
}

export function localGuards(csrfToken: string): MiddlewareHandler {
  return async (context, next) => {
    const refusal = checkRequest({
      host: context.req.header('host'),
      origin: context.req.header('origin'),
      method: context.req.method,
      path: context.req.path,
      csrf: context.req.header(CSRF_HEADER),
    }, csrfToken);
    if (refusal !== null) {
      return context.json({ code: refusal }, 403);
    }
    if (context.req.path !== TELEMETRY_PATH) {
      await next();
      return undefined;
    }
    if (context.req.method === 'OPTIONS') {
      const preflight = new Response(null, { status: 204 });
      setTelemetryCors(preflight.headers);
      return preflight;
    }
    await next();
    setTelemetryCors(context.res.headers);
    return undefined;
  };
}
