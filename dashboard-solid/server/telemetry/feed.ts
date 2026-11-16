/**
 * The team feed: merges our own telemetry with the v2 relay, and pushes the result to /live subscribers.
 * Own telemetry wins when it is live. Broadcasts only when something changed, at most once per tick,
 * so freshness transitions (live → stale) reach the UI without any polling on its side.
 */
import type { Stock } from '../../shared/stock.ts';
import type { CharacterLive, TeamLive } from '../../shared/telemetry.ts';
import type { TelemetryStore } from './store.ts';
import { mergeStock } from './stock.ts';
import { pollV2 } from './v2-relay.ts';

export interface TeamFeed {
  readonly snapshot: () => TeamLive;
  /** Bags, equipment and bank from both sources, newest report first. */
  readonly stock: () => Stock;
  readonly subscribe: (send: (team: TeamLive) => void) => () => void;
  /** Starts the relay polling and the broadcast tick; returns the stop function. */
  readonly start: () => () => void;
}

export interface FeedOptions {
  readonly store: TelemetryStore;
  readonly relayV2Url: string;
  readonly now?: () => number;
  readonly fetch?: typeof fetch;
}

export function mergeCharacters(own: readonly CharacterLive[], relayed: readonly CharacterLive[]): CharacterLive[] {
  const byName = new Map<string, CharacterLive>(relayed.map((character) => [character.name, character]));
  for (const character of own) {
    const other = byName.get(character.name);
    if (other === undefined || character.freshness === 'live' || other.freshness !== 'live') {
      byName.set(character.name, character);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function createTeamFeed(options: FeedOptions): TeamFeed {
  const now = options.now ?? Date.now;
  const subscribers = new Set<(team: TeamLive) => void>();
  let relayed: CharacterLive[] = [];
  let relayedStock: Stock = { characters: [], bank: null };
  let lastSent = '';

  const snapshot = (): TeamLive => ({ at: now(), characters: mergeCharacters(options.store.snapshot(), relayed) });
  const broadcast = (): void => {
    const team = snapshot();
    const key = JSON.stringify(team.characters);
    if (key === lastSent) {
      return;
    }
    lastSent = key;
    subscribers.forEach((send) => { send(team); });
  };

  return {
    snapshot,
    stock: () => mergeStock(options.store.stock(), relayedStock),
    subscribe: (send) => {
      subscribers.add(send);
      send(snapshot());
      return () => { subscribers.delete(send); };
    },
    start: () => {
      const timers = [setInterval(broadcast, 1000)];
      if (options.relayV2Url !== '') {
        const poll = async (): Promise<void> => {
          const polled = await pollV2(options.relayV2Url, now(), options.fetch);
          if (polled !== null) {
            ({ characters: relayed, stock: relayedStock } = polled);
          }
        };
        void poll();
        timers.push(setInterval(() => { void poll(); }, 2000));
      }
      timers.forEach((timer) => { timer.unref(); });
      return () => { timers.forEach((timer) => { clearInterval(timer); }); };
    },
  };
}
