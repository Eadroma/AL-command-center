/**
 * An in-memory Adventure Land game API for deployment tests: CODE slots and connected characters, answering in the
 * shapes recorded from the real API on 2026-10-27 (list_codes, get_code, browser_code_status). Records every call.
 * No test reaches the real account: the service only ever talks to this client.
 */
import type { McpClient, McpResult } from '../../server/mcp/client.ts';

interface Slot {
  name: string;
  version: number;
  code: string;
}

export interface FakeGame {
  readonly client: McpClient;
  readonly calls: { method: string; args: Readonly<Record<string, unknown>> }[];
  readonly slots: Map<string, Slot>;
  readonly online: Set<string>;
  readonly running: Set<string>;
  /** When set, save_code stores something else than what was sent (to test the read-back check). */
  corruptNextSave: boolean;
}

const rejected = (reason: string): McpResult<unknown> => ({ ok: false, error: { code: 'mcp.rejected', detail: reason } });
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export function fakeGame(initial: { readonly slots?: Record<string, Slot>; readonly online?: readonly string[] } = {}): FakeGame {
  const game: FakeGame = {
    calls: [],
    slots: new Map(Object.entries(initial.slots ?? {})),
    online: new Set(initial.online ?? []),
    running: new Set(),
    corruptNextSave: false,
    client: { call: (method, args = {}) => { game.calls.push({ method, args }); return Promise.resolve(answer(method, args)); } },
  };

  function status(character: string): McpResult<unknown> {
    return { ok: true, value: { success: true, character, runtime: 'browser', server: 'EUIII', online: game.online.has(character), code_running: game.running.has(character) } };
  }

  function codeStart(character: string, slot: string): McpResult<unknown> {
    if (!game.online.has(character)) {
      return rejected('character_not_online');
    }
    if (!game.slots.has(slot)) {
      return rejected('code_not_found');
    }
    game.running.add(character);
    return { ok: true, value: { success: true } };
  }

  function saveCode(args: Readonly<Record<string, unknown>>): McpResult<unknown> {
    const slot = text(args['slot']);
    const sent = text(args['code']);
    game.slots.set(slot, { name: text(args['name']), version: (game.slots.get(slot)?.version ?? 0) + 1, code: game.corruptNextSave ? `${sent}//x` : sent });
    game.corruptNextSave = false;
    return { ok: true, value: { success: true } };
  }

  function getCode(slot: string): McpResult<unknown> {
    const entry = game.slots.get(slot);
    return entry === undefined ? rejected('code_not_found') : { ok: true, value: { success: true, code: { slot, name: entry.name, version: entry.version, code: entry.code } } };
  }

  const handlers: Readonly<Record<string, (args: Readonly<Record<string, unknown>>) => McpResult<unknown>>> = {
    list_codes: () => ({ ok: true, value: { success: true, codes: [...game.slots].map(([key, entry]) => ({ slot: key, name: entry.name, version: entry.version })) } }),
    get_code: (args) => getCode(text(args['slot'])),
    save_code: saveCode,
    browser_code_status: (args) => status(text(args['character'])),
    browser_code_reload: (args) => codeStart(text(args['character']), text(args['slot'])),
    browser_code_start: (args) => codeStart(text(args['character']), text(args['slot'])),
    browser_code_stop: (args) => { game.running.delete(text(args['character'])); return { ok: true, value: { success: true } }; },
  };

  function answer(method: string, args: Readonly<Record<string, unknown>>): McpResult<unknown> {
    return handlers[method]?.(args) ?? rejected('unknown_method');
  }

  return game;
}

/** The methods that change something in the game (everything else only reads). */
export const WRITE_METHODS: ReadonlySet<string> = new Set(['save_code', 'browser_code_reload', 'browser_code_start', 'browser_code_stop']);
