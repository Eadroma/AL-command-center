/** Characters found by the connection test, shown as the game's notched inventory slots. */
import type { JSX } from 'solid-js';
import { For } from 'solid-js';
import type { AccountCharacter } from '../../../shared/account.ts';
import { t } from '../../i18n/i18n.ts';

const knownClasses = ['warrior', 'priest', 'rogue', 'ranger', 'mage', 'paladin', 'merchant'] as const;
type KnownClass = (typeof knownClasses)[number];

function isKnownClass(value: string | null): value is KnownClass {
  return knownClasses.some((known) => known === value);
}

export function className(value: string | null): string {
  return isKnownClass(value) ? t(`classes.${value}`) : t('classes.unknown');
}

export function Roster(props: { readonly characters: readonly AccountCharacter[] }): JSX.Element {
  return (
    <>
      <p class="found" role="status">{t('settings.charactersFound', { count: props.characters.length })}</p>
      <ul class="roster">
        <For each={props.characters}>
          {(character) => (
            <li class="slot">
              <span class="name">{character.name}</span>
              <span class="class">{className(character.className)}</span>
              <span class="level">{t('settings.level', { level: character.level })}</span>
            </li>
          )}
        </For>
      </ul>
    </>
  );
}
