import type { FarmStyle, Profile } from '../../shared/schema';
import type { BuildItem, CharacterTelemetry } from '../types/deployments';

export const BUILD_METRICS = ['attack', 'str', 'dex', 'int', 'vit', 'armor', 'resistance', 'speed', 'range', 'hp', 'mp', 'frequency', 'mp_cost', 'mp_reduction', 'output', 'crit', 'lifesteal', 'manasteal', 'gold', 'luck'] as const;

/** Resolve physical copies once. Unspecified slots inherit current equipment, not unknown script defaults. */
export function resolveBuild(profile: Profile, character: string, style: FarmStyle, telemetry?: CharacterTelemetry) {
  const rules = profile.farming.loadouts[character]?.[style]?.gear ?? [];
  const equipment = telemetry?.equipment ?? [];
  const items = telemetry?.buildItems ?? [];
  const used = new Set<string>();
  const key = (item: BuildItem) => `${item.location}:${item.slot}`;
  const overridden = new Set<string>(rules.map(rule => rule.slot));
  const slots = [...new Set([...equipment.map(item => item.slot), ...rules.map(rule => rule.slot)])];
  const selected = new Map<string, BuildItem>();
  // Reserve inherited gear before selecting override copies from the same pool.
  for (const slot of slots.filter(slot => !overridden.has(slot))) {
    const item = items.find(item => item.location === 'equipment' && item.slot === slot);
    if (item) { selected.set(slot, item); used.add(key(item)); }
  }
  const missing: string[] = [];
  for (const rule of rules) {
    const match = items.filter(item => item.name === rule.item && item.level >= rule.minLevel && !used.has(key(item)))
      .sort((a, b) => Number(b.location === 'equipment' && b.slot === rule.slot) - Number(a.location === 'equipment' && a.slot === rule.slot) || b.level - a.level)[0];
    if (match) { selected.set(rule.slot, match); used.add(key(match)); }
    else missing.push(`${rule.slot}: ${rule.item} +${rule.minLevel}`);
  }
  const unknown = slots.filter(slot => !selected.has(slot));
  const complete = !!telemetry?.live && !!telemetry.buildItems && unknown.length === 0;
  const totals = Object.fromEntries(BUILD_METRICS.map(metric => [metric, complete ? [...selected.values()].reduce((sum, item) => sum + (item.properties[metric] ?? 0), 0) : null]));
  return { style, selected, slots, missing, unknown, complete, totals, skills: profile.farming.loadouts[character]?.[style]?.skills ?? [] };
}
