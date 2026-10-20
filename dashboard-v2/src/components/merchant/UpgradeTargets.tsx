import { api } from '../../api/client';
import { Fragment, useState } from 'react';
import type { Catalog, Profile } from '../../types';
import type { CharacterTelemetry } from '../../types/deployments';
import { removeUpgradeRule, setUpgradeRule, setUpgradeNpcPurchase } from '../../models/merchant';
import { Badge, Button, NumberInput, Sprite, Toggle } from '../ui';
import { UpgradeProductionControls } from './UpgradeProductionControls';
import { UpgradeSteps } from './UpgradeSteps';
import styles from './MerchantPlanner.module.scss';
type Rule = Profile['seller']['upgrade']['rules'][number];
export function UpgradeTargets({ profile, catalog, pending, telemetry, onChange }: { profile: Profile; catalog: Catalog; pending: boolean; telemetry?: CharacterTelemetry; onChange: (profile: Profile) => void }) {
  const [pausePending,setPausePending]=useState<string|null>(null);
  const [pauseError,setPauseError]=useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const updateRule = (updated: Rule) => onChange({ ...profile, seller: { ...profile.seller, upgrade: { ...profile.seller.upgrade, rules: profile.seller.upgrade.rules.map(rule => rule.item === updated.item ? updated : rule) } } });
  if (!profile.seller.upgrade.rules.length) return <p>No upgrade items configured.</p>;
  return <div className={styles.tableWrap}>
    {pauseError&&<p role="alert">{pauseError}</p>}
    <p>Pause preserves targets, budgets and counters. A submitted action may finish; no new attempts start after the pause is applied. Save the rule change to keep the dashboard configuration in sync.</p>
    <table className={`${styles.historyTable} ${styles.upgradeTable}`}>
      <caption>Upgrade targets · carried stock first</caption>
      <thead><tr><th>Equipment</th><th>Target</th><th>NPC supply</th><th>Production contract</th><th>Actions</th></tr></thead>
      <tbody>{profile.seller.upgrade.rules.map(rule => {
        const item = catalog.items.find(item => item.id === rule.item);
        return <Fragment key={rule.item}>
          <tr className={rule.paused ? styles.upgradePaused : styles.upgradeActive}>
            <td><div className={styles.reviewHeading}><Sprite id={`item:${rule.item}`} catalog={catalog} label={item?.name ?? rule.item} size={32} /><strong>{item?.name ?? rule.item}</strong><Badge variant={rule.paused ? 'neutral' : 'success'}>{rule.paused ? 'Paused' : 'Enabled'}</Badge></div></td>
            <td><NumberInput id={`upgrade-target-${rule.item}`} aria-label={`${item?.name ?? rule.item} target level`} min={0} max={15} value={rule.maxLevel} disabled={pending} onChange={value => value !== null && onChange(setUpgradeRule(profile, rule.item, value))} /></td>
            <td>{item?.npcShops?.length ? <Toggle label="Buy missing base" value={!!rule.buyNpc} disabled={pending} onChange={buyNpc => onChange(setUpgradeNpcPurchase(profile, rule.item, buyNpc))} /> : <span>Not sold by NPC</span>}</td>
            <td><details><summary>{rule.production?.enabled ? `${rule.production.quantity} pieces · ${rule.production.budget.toLocaleString()} gold` : 'Continuous · set limits'}</summary><UpgradeProductionControls rule={rule} pending={pending} telemetry={telemetry} onChange={updateRule} /></details></td>
            <td><Button size="small" variant="secondary" disabled={pending||pausePending!==null} onClick={async()=>{setPausePending(rule.item);setPauseError('');try{await api('/api/merchant/upgrade/pause',{item:rule.item,paused:!rule.paused});updateRule({...rule,paused:!rule.paused});}catch(e){setPauseError(e instanceof Error?e.message:'Pause failed');}finally{setPausePending(null);}}}>{rule.paused?'Resume':'Pause'}</Button><Button size="small" variant="secondary" aria-expanded={expanded === rule.item} aria-controls={`upgrade-steps-${rule.item}`} onClick={() => setExpanded(expanded === rule.item ? null : rule.item)}>Scrolls & offerings</Button><Button size="small" variant="ghost" disabled={pending} onClick={() => onChange(removeUpgradeRule(profile, rule.item))}>Remove</Button></td>
          </tr>
          {expanded === rule.item && <tr><td colSpan={5} id={`upgrade-steps-${rule.item}`} className={styles.stepsCell}><strong>{item?.name ?? rule.item} · upgrade recipe</strong><UpgradeSteps rule={rule} catalog={catalog} pending={pending} onChange={updateRule} /></td></tr>}
        </Fragment>;
      })}</tbody>
    </table>
  </div>;
}
