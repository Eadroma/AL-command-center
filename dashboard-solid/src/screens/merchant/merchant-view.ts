/** Merchant screen model (pure): its activities, each on or off as the profile says, and which ones are editable here. */
import type { Profile } from '../../../shared/profile.ts';
import { field, truthy } from '../../../shared/raw.ts';

export const ACTIVITIES = ['supply', 'npc', 'exchange', 'craft', 'upgrade', 'stand', 'ponty', 'seasonal'] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** Activities with their own screen so far; the others stay as imported until their card is done. */
export const EDITABLE: ReadonlySet<Activity> = new Set<Activity>(['supply']);

/** A board absent from the profile is on by default, as in dashboard-v2. */
function boardOn(seller: unknown, board: string): boolean {
  const enabled = field(field(seller, board), 'enabled');
  return enabled === undefined || truthy(enabled);
}

const flag = (seller: unknown, key: string): boolean => truthy(field(seller, key));

const enabled = (seller: unknown, board: string): boolean => truthy(field(field(seller, board), 'enabled'));

const ON: Readonly<Record<Activity, (seller: unknown) => boolean>> = {
  supply: (seller) => boardOn(seller, 'kit') || boardOn(seller, 'consumables'),
  npc: (seller) => flag(seller, 'npcEnabled'),
  exchange: (seller) => enabled(seller, 'exchange'),
  craft: (seller) => enabled(seller, 'craft'),
  upgrade: (seller) => enabled(seller, 'upgrade') || enabled(seller, 'compound'),
  stand: (seller) => flag(seller, 'standEnabled') || enabled(seller, 'buy'),
  ponty: (seller) => enabled(seller, 'ponty'),
  seasonal: (seller) => enabled(seller, 'trickOrTreat') || enabled(seller, 'witchCipher'),
};

export function activityOn(profile: Profile, activity: Activity): boolean {
  return ON[activity](profile['seller']);
}
