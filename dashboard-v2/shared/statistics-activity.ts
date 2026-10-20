import { expeditionBosses } from './event-expedition';
export type StatisticsActivity = 'all' | 'farming' | 'events' | 'cave' | 'unknown';
export function statisticsActivity(row: { map?: string; farmContext?: { monster?: string; activity?: string } }): Exclude<StatisticsActivity, 'all'> {
  const explicit = row.farmContext?.activity;
  if (explicit === 'cave' || explicit === 'events' || explicit === 'farming') return explicit;
  if (row.map?.startsWith('cave')) return 'cave';
  if (!row.farmContext?.monster) return 'unknown';
  return (expeditionBosses as readonly string[]).includes(row.farmContext.monster) ? 'events' : 'farming';
}
