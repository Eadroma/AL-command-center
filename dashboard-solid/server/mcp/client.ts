/**
 * Adventure Land JSON API client (the MCP methods, called over HTTP like dashboard-v2 does).
 * Errors come back as values with stable codes the UI translates; the token is never logged or returned.
 */

export type McpErrorCode = 'mcp.missingToken' | 'mcp.unreachable' | 'mcp.httpError' | 'mcp.rejected' | 'mcp.unexpectedResponse';

export interface McpError {
  readonly code: McpErrorCode;
  /** Short, sanitized reason from the game (for example `invalid_token`); shown as-is inside a translated message. */
  readonly detail?: string;
}

export type McpResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: McpError };

export interface McpClient {
  readonly call: (method: string, args?: Readonly<Record<string, unknown>>) => Promise<McpResult<unknown>>;
}

export interface McpClientOptions {
  /** The MCP address from settings (https://adventure.land/mcp); the JSON API lives next to it. */
  readonly mcpUrl: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export function apiBase(mcpUrl: string): string {
  return new URL('/mcp_api/', mcpUrl).toString();
}

function sanitize(reason: unknown): string {
  const text = typeof reason === 'string' && reason !== '' ? reason : 'request_rejected';
  return text.replace(/[^\w -]/g, '').slice(0, 100);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

export function createMcpClient(options: McpClientOptions): McpClient {
  const fetchImpl = options.fetch ?? fetch;
  const base = apiBase(options.mcpUrl);
  return {
    call: async (method, args = {}) => {
      if (options.token === '') {
        return { ok: false, error: { code: 'mcp.missingToken' } };
      }
      let response: Response;
      try {
        response = await fetchImpl(base + method, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...args, token: options.token }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
        });
      } catch {
        return { ok: false, error: { code: 'mcp.unreachable' } };
      }
      if (!response.ok) {
        return { ok: false, error: { code: 'mcp.httpError', detail: String(response.status) } };
      }
      const body: unknown = await response.json().catch(() => null);
      if (!isRecord(body)) {
        return { ok: false, error: { code: 'mcp.unexpectedResponse' } };
      }
      if (body['failed'] === true || body['success'] !== true) {
        return { ok: false, error: { code: 'mcp.rejected', detail: sanitize(body['reason']) } };
      }
      return { ok: true, value: body };
    },
  };
}
