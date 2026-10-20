import type { CharacterTelemetry } from '../../types/deployments';
import { useState } from 'react';
import type { Catalog, Profile } from '../../types';
import { simulateUpgrade } from '../../models/upgrade-simulation';
import { Field, NumberInput, SelectInput, Sprite } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantPlanner.module.scss';
export function UpgradeSimulator({ profile, catalog, telemetry }: { profile: Profile; catalog: Catalog; telemetry?: CharacterTelemetry }) {
  const [selected, setSelected] = useState('');
  const [base, setBase] = useState<number | null>(null);
  const [steps, setSteps] = useState<Record<string, { probability: number | null; scrollCost: number | null }>>({});
  const rule = profile.seller.upgrade.rules.find(r => r.item === selected) ?? profile.seller.upgrade.rules[0];
  const item = catalog.items.find(item => item.id === rule?.item);
  const levels = Array.from({ length: rule?.maxLevel ?? 0 }, (_, level) => level);
  const cost = base ?? item?.goldValue ?? 0;
  const result = rule && levels.length ? simulateUpgrade(cost, levels.map(level => { const step = steps[`${rule.item}:${level}`]; return { probability: (step?.probability ?? 0) / 100, scrollCost: step?.scrollCost ?? NaN }; })) : null;
  function update(level: number, change: { probability?: number | null; scrollCost?: number | null }) { if (!rule) return; const key = `${rule.item}:${level}`; setSteps(old => ({ ...old, [key]: { ...(old[key] ?? { probability: null, scrollCost: null }), ...change } })); }
  return <CollapsiblePanel id="upgrade-simulator" title="Upgrade simulation" eyebrow="Assumptions · no game actions">
    <p>From +0 to the configured target. Enter the success chance and scroll cost for every step. No live chance lookup, offerings, luck effects or fees are included. Expected values are averages, not spending guarantees.</p>
    {!rule ? <p>Add an upgrade rule first.</p> : <>
      <Sprite id={`item:${rule.item}`} catalog={catalog} label={item?.name ?? rule.item} size={32} />
      <Field label="Equipment" htmlFor="sim-upgrade-item"><SelectInput id="sim-upgrade-item" value={rule.item} onChange={value => { setSelected(value); setBase(null); }} options={profile.seller.upgrade.rules.map(r => ({ value: r.item, label: `${catalog.items.find(i => i.id === r.item)?.name ?? r.item} → +${r.maxLevel}` }))} /></Field>
      <Field label="Base price or replacement value" htmlFor="sim-upgrade-base"><NumberInput id="sim-upgrade-base" min={0} max={2e12} value={cost} onChange={setBase} /></Field>
      <div className={styles.tableWrap}><table className={styles.historyTable}><thead><tr><th>Step</th><th>Success chance %</th><th>Scroll cost</th><th>Observed outcomes</th></tr></thead><tbody>{levels.map(level => {
        const observed = telemetry?.upgradeHistory?.totals.find(row => row.item === rule.item && row.level === level && row.kind === 'upgrade');
        const known = (observed?.successes ?? 0) + (observed?.destroyed ?? 0);
        return <tr key={level}><td>+{level} → +{level + 1}</td><td><NumberInput id={`sim-chance-${level}`} aria-label={`Step ${level + 1} success chance percent`} min={0.01} max={100} step={0.01} value={steps[`${rule.item}:${level}`]?.probability ?? null} onChange={probability => update(level, { probability })} /></td><td><NumberInput id={`sim-cost-${level}`} aria-label={`Step ${level + 1} scroll cost`} min={0} max={2e12} value={steps[`${rule.item}:${level}`]?.scrollCost ?? null} onChange={scrollCost => update(level, { scrollCost })} /></td><td>{known ? `${observed!.successes}/${known} confirmed · ${(100 * observed!.successes / known).toFixed(1)}%${telemetry?.live ? '' : ' · stored sample'}` : 'No confirmed sample'}</td></tr>;
      })}</tbody></table></div>
      {result ? <p aria-live="polite">Expected cost: {Math.round(result.expectedCost).toLocaleString()} gold · Bases: {result.expectedBases.toFixed(2)} · Destroyed: {result.expectedDestroyed.toFixed(2)} · Scrolls: {result.expectedScrolls.toFixed(2)} · Success per base: {(result.chancePerBase * 100).toFixed(3)}%</p> : <p>Enter all step assumptions to calculate. Each failure is assumed to destroy the piece and restart from +0.</p>}
    </>}
  </CollapsiblePanel>;
}
