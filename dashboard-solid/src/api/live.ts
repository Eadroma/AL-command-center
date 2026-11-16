/**
 * Live team state over the /live WebSocket: the server pushes the full team on connect and on every change,
 * so the UI never polls. Reconnects on its own, waiting 1 s, 2 s, 4 s… up to 10 s between attempts.
 */
import type { Accessor } from 'solid-js';
import { createSignal, onCleanup } from 'solid-js';
import type { TeamLive } from '../../shared/telemetry.ts';
import { liveMessageSchema } from '../../shared/telemetry.ts';

export type Connection = 'connecting' | 'open' | 'closed';

export interface LiveTeam {
  readonly team: Accessor<TeamLive | null>;
  readonly connection: Accessor<Connection>;
}

export function reconnectDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

function liveUrl(): string {
  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}/live`;
}

/** Must be called inside a component or root: the socket closes with it. */
export function createLiveTeam(): LiveTeam {
  const [team, setTeam] = createSignal<TeamLive | null>(null);
  const [connection, setConnection] = createSignal<Connection>('connecting');
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const connect = (): void => {
    setConnection('connecting');
    socket = new WebSocket(liveUrl());
    socket.addEventListener('open', () => { attempt = 0; setConnection('open'); });
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      const parsed = liveMessageSchema.safeParse(typeof event.data === 'string' ? JSON.parse(event.data) : null);
      if (parsed.success && parsed.data.type === 'team') {
        setTeam(parsed.data.team);
      }
    });
    socket.addEventListener('close', () => {
      setConnection('closed');
      if (!disposed) {
        timer = setTimeout(connect, reconnectDelayMs(attempt));
        attempt += 1;
      }
    });
  };

  connect();
  onCleanup(() => {
    disposed = true;
    clearTimeout(timer);
    socket?.close();
  });
  return { team, connection };
}
