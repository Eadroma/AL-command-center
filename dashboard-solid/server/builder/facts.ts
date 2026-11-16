/** Game facts the profile validation needs, read from the game data the dashboard keeps up to date (G). */
import type { GameData } from '../game-data/data-js.ts';
import { field, isRecord, truthy } from '../../shared/raw.ts';
import type { GameFacts } from './validate.ts';

export function gameFacts(data: GameData): GameFacts {
  const item = (id: string): unknown => (Object.hasOwn(data.items, id) ? data.items[id] : undefined);
  const craft = data['craft'];
  return {
    upgradeable: (id) => truthy(field(item(id), 'upgrade')),
    compoundable: (id) => truthy(field(item(id), 'compound')),
    hasRecipe: (id) => isRecord(craft) && Object.hasOwn(craft, id),
  };
}
