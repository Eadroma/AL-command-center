/** Event names and sprites: the game's monster when there is one, a translated name for the others. */
import type { MonsterSummary, SpriteFrame } from '../../../shared/game.ts';
import { EVENTS } from '../../../shared/events.ts';
import { t } from '../../i18n/i18n.ts';

const NAMED = ['graveyard', 'goobrawl', 'abtesting'] as const;

export interface EventLook {
  readonly name: string;
  readonly sprite: SpriteFrame | null;
}

/** How an event or boss id is shown: its name in the current language and the sprite of its monster. */
export function eventLook(id: string, monsters: ReadonlyMap<string, MonsterSummary>): EventLook {
  const monster = monsters.get(EVENTS.find((entry) => entry.id === id)?.monster ?? id);
  const named = NAMED.find((entry) => entry === id);
  return { name: named === undefined ? monster?.name ?? id : t(`events.name.${named}`), sprite: monster?.sprite ?? null };
}
