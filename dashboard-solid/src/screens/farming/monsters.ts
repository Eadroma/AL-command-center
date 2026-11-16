/** Monsters as choices for the farming screens (pure: tested without a browser). */
import type { MonsterSummary } from '../../../shared/game.ts';
import { locale, t } from '../../i18n/i18n.ts';
import type { Choice } from '../../ui/choices.ts';

export function monsterStats(monster: MonsterSummary): string {
  const number = new Intl.NumberFormat(locale());
  return t('farming.stats', {
    hp: number.format(monster.hp), xp: monster.xp === null ? t('farming.noXp') : number.format(monster.xp),
    maps: monster.maps.length > 0 ? monster.maps.join(', ') : t('farming.noMaps'),
  });
}

export function monsterChoice(monster: MonsterSummary): Choice {
  return { key: monster.key, name: monster.name, detail: monsterStats(monster), image: monster.sprite };
}
