/** Pure view model of the Team screen: merges live state, account roster and sprites (tested without a browser). */
import type { AccountCharacter } from '../../../shared/account.ts';
import type { CharacterSprites, SpriteFrame } from '../../../shared/game.ts';
import type { CharacterLive, TeamLive } from '../../../shared/telemetry.ts';

export interface CharacterCardModel {
  readonly name: string;
  readonly className: string | null;
  readonly level: number | null;
  readonly live: CharacterLive;
  readonly sprite: SpriteFrame | null;
}

export interface TeamView {
  /** Characters with telemetry, in the account's fixed order. */
  readonly reporting: readonly CharacterCardModel[];
  /** Characters the dashboard never heard from. */
  readonly silent: readonly CharacterCardModel[];
}

/** 0..100, or null when either value is unknown or the maximum is not positive. */
export function percent(value: number | null, max: number | null): number | null {
  if (value === null || max === null || max <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function spriteFor(live: CharacterLive, className: string | null, sprites: CharacterSprites | null): SpriteFrame | null {
  const bySkin = live.skin === null ? undefined : sprites?.skins[live.skin];
  const byClass = className === null ? undefined : sprites?.classes[className];
  return bySkin ?? byClass ?? null;
}

/**
 * Fixed order: the account's own order (the game's), then by name for characters it does not list.
 * Freshness never reorders cards: packets arrive every few seconds and a 20 s threshold flickers,
 * which made the cards jump around (reported on 2026-10-26). Freshness only changes how a card looks.
 */
function compareCards(rosterIndex: ReadonlyMap<string, number>): (a: CharacterCardModel, b: CharacterCardModel) => number {
  return (a, b) => {
    const byRoster = (rosterIndex.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (rosterIndex.get(b.name) ?? Number.MAX_SAFE_INTEGER);
    return byRoster !== 0 ? byRoster : a.name.localeCompare(b.name);
  };
}

export function buildTeamView(team: TeamLive | null, roster: readonly AccountCharacter[], sprites: CharacterSprites | null): TeamView {
  const byName = new Map(roster.map((character) => [character.name, character]));
  const rosterIndex = new Map(roster.map((character, index) => [character.name, index]));
  const cards = (team?.characters ?? []).map((live): CharacterCardModel => {
    const account = byName.get(live.name);
    const className = account?.className ?? null;
    return { name: live.name, className, level: live.level ?? account?.level ?? null, live, sprite: spriteFor(live, className, sprites) };
  });
  cards.sort(compareCards(rosterIndex));
  return {
    reporting: cards.filter((card) => card.live.freshness !== 'never'),
    silent: cards.filter((card) => card.live.freshness === 'never'),
  };
}
