/** Searching a list of named choices (monsters, items…) by typed text. Pure: tested without a browser. */
import type { SpriteFrame } from '../../shared/game.ts';

export interface Named {
  readonly key: string;
  readonly name: string;
}

/** One line of a choice list: image, name, and a short details line. */
export interface Choice extends Named {
  readonly detail: string;
  readonly image: SpriteFrame | null;
}

/** The choice a typed text designates: its key, or its exact name (any case). */
export function resolveChoice<T extends Named>(text: string, choices: readonly T[]): T | null {
  const wanted = text.trim().toLowerCase();
  return choices.find((choice) => choice.key === wanted) ?? choices.find((choice) => choice.name.toLowerCase() === wanted) ?? null;
}

/**
 * The choices a typed text matches, best first: the exact name, names that start with it, then names or keys that
 * contain it. An empty text, or the text of the current choice (the field just opened), shows every choice.
 */
export function filterChoices<T extends Named>(choices: readonly T[], query: { readonly text: string; readonly current: string }, limit: number): T[] {
  const wanted = query.text.trim().toLowerCase();
  if (wanted === '' || wanted === query.current.toLowerCase()) {
    return choices.slice(0, limit);
  }
  const exact = (choice: T): boolean => choice.name.toLowerCase() === wanted || choice.key === wanted;
  const starts = choices.filter((choice) => choice.name.toLowerCase().startsWith(wanted)).toSorted((a, b) => Number(exact(b)) - Number(exact(a)));
  const contains = choices.filter((choice) => !starts.includes(choice) && (choice.name.toLowerCase().includes(wanted) || choice.key.includes(wanted)));
  return [...starts, ...contains].slice(0, limit);
}
