/**
 * Telemetry sessions and live character state.
 * - A session is created per deployed bundle: the script carries a random 256-bit ticket, the store keeps only
 *   its SHA-256 (same scheme as dashboard-v2, so its bundles stay compatible). Sessions expire after 7 days.
 * - Packets must have a known ticket for that character, a growing sequence, and at most one per second.
 * - Commands are resent with every answer until the script acknowledges them (protocol 2).
 * Session identities are persisted (tickets must survive a restart); live state stays in memory.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { BankStock, Stock } from '../../shared/stock.ts';
import type { CharacterLive } from '../../shared/telemetry.ts';
import { freshnessOf } from '../../shared/telemetry.ts';
import { EMPTY_INSIGHT, insightOf } from './insight.ts';
import { characterLive } from './live-state.ts';
import type { Packet } from './packet.ts';
import { packetSchema } from './packet.ts';
import { bankStockOf, characterStockOf, mergeStock } from './stock.ts';

const SESSION_TTL_MS = 7 * 86_400_000;
const MIN_INTERVAL_MS = 1000;
const POSITIONS_WINDOW_MS = 10 * 60_000;
const KEPT_LOGS = 20;

export interface RuntimeCommand {
  readonly id: string;
  readonly type: string;
  readonly createdAt: number;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface SessionRecord {
  readonly id: string;
  readonly character: string;
  readonly ticketHash: string;
  readonly createdAt: number;
}

interface LiveState {
  readonly sequence: number;
  readonly lastSeen: number | null;
  readonly packet: Packet | null;
  readonly positions: readonly { readonly at: number; readonly map: string; readonly x: number; readonly y: number }[];
  readonly commands: readonly RuntimeCommand[];
  /** The script sends only its new lines; they are dated on arrival. */
  readonly logs: CharacterLive['logs'];
  /** The last bank snapshot this character sent: scripts only send one while their bank is known. */
  readonly bank: BankStock | null;
}

const EMPTY_STATE: LiveState = { sequence: -1, lastSeen: null, packet: null, positions: [], commands: [], logs: [], bank: null };

export type IngestResult =
  | { readonly ok: true; readonly accepted: boolean; readonly commands: readonly RuntimeCommand[] }
  | { readonly ok: false; readonly code: 'telemetry.invalidPacket' | 'telemetry.unknownTicket' };

export interface TelemetryStore {
  readonly createSession: (character: string) => { readonly session: SessionRecord; readonly ticket: string };
  readonly ingest: (input: unknown) => IngestResult;
  readonly enqueue: (character: string, type: string, payload?: Readonly<Record<string, unknown>>) => RuntimeCommand | null;
  readonly snapshot: () => CharacterLive[];
  /** Bags and equipment of each character, and the newest bank snapshot. */
  readonly stock: () => Stock;
  readonly sessions: () => readonly SessionRecord[];
}

export function hashTicket(ticket: string): string {
  return createHash('sha256').update(ticket).digest('hex');
}

function toLive(name: string, state: LiveState, now: number): CharacterLive {
  const { packet } = state;
  return characterLive({
    name, source: 'telemetry', lastSeen: state.lastSeen, stats: packet?.stats, activity: packet?.intent?.state, positions: state.positions,
    failures: packet?.failures ?? [], insight: packet === null ? EMPTY_INSIGHT : insightOf(packet, null), logs: state.logs, now,
  });
}

/** State after one accepted packet: receipts clear their commands, positions keep a 10-minute trail. */
function apply(state: LiveState, packet: Packet, now: number): LiveState {
  const acknowledged = new Set((packet.commandReceipts ?? []).map((receipt) => receipt.id));
  return {
    sequence: packet.sequence,
    lastSeen: now,
    packet,
    commands: state.commands.filter((command) => !acknowledged.has(command.id)),
    positions: [...state.positions, { at: now, map: packet.stats.map, x: packet.stats.x, y: packet.stats.y }]
      .filter((point) => point.at >= now - POSITIONS_WINDOW_MS)
      .slice(-120),
    logs: [...state.logs, ...packet.logs.map((message) => ({ at: now, message }))].slice(-KEPT_LOGS),
    bank: bankStockOf(packet.character, packet, now) ?? state.bank,
  };
}

export function createTelemetryStore(initial: readonly SessionRecord[], onSessionsChanged: (sessions: readonly SessionRecord[]) => void, now: () => number = Date.now): TelemetryStore {
  let sessions = initial.filter((session) => now() - session.createdAt <= SESSION_TTL_MS);
  const live = new Map<string, LiveState>();
  const stateOf = (character: string): LiveState => live.get(character) ?? EMPTY_STATE;

  return {
    createSession: (character) => {
      const ticket = randomBytes(32).toString('hex');
      const session: SessionRecord = { id: randomUUID(), character, ticketHash: hashTicket(ticket), createdAt: now() };
      sessions = [...sessions.filter((existing) => now() - existing.createdAt <= SESSION_TTL_MS), session];
      onSessionsChanged(sessions);
      return { session, ticket };
    },
    ingest: (input) => {
      const parsed = packetSchema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, code: 'telemetry.invalidPacket' };
      }
      const packet = parsed.data;
      const digest = hashTicket(packet.ticket);
      if (!sessions.some((session) => session.ticketHash === digest && session.character === packet.character && now() - session.createdAt <= SESSION_TTL_MS)) {
        return { ok: false, code: 'telemetry.unknownTicket' };
      }
      const state = stateOf(packet.character);
      const tooSoon = state.lastSeen !== null && now() - state.lastSeen < MIN_INTERVAL_MS;
      const accepted = packet.sequence > state.sequence && !tooSoon;
      const next = accepted ? apply(state, packet, now()) : state;
      live.set(packet.character, next);
      return { ok: true, accepted, commands: next.commands };
    },
    enqueue: (character, type, payload) => {
      const state = live.get(character);
      if (state === undefined || freshnessOf(state.lastSeen, now()) !== 'live' || state.commands.length >= 42) {
        return null;
      }
      const command: RuntimeCommand = { id: randomUUID(), type, createdAt: now(), ...(payload === undefined ? {} : { payload }) };
      live.set(character, { ...state, commands: [...state.commands, command] });
      return command;
    },
    snapshot: () => [...live].map(([name, state]) => toLive(name, state, now())),
    stock: () => {
      const states = [...live];
      const characters = states.flatMap(([name, state]) => { const stock = state.lastSeen === null ? null : characterStockOf(name, state.packet, state.lastSeen); return stock === null ? [] : [stock]; });
      const banks = states.flatMap(([, state]) => (state.bank === null ? [] : [{ characters: [], bank: state.bank }]));
      return mergeStock({ characters, bank: null }, ...banks);
    },
    sessions: () => sessions,
  };
}
