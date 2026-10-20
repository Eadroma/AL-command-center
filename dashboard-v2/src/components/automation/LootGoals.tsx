import { useState } from 'react';
import type { Profile, Catalog, DeploymentsResponse } from '../../types';
import { Badge, Button, Card, Field, ItemMultiSelect, NumberInput, SelectInput, Sprite, Toggle } from '../ui';
import styles from './AutomationPanels.module.scss';

export function LootGoals({ profile, catalog, deployments, disabled, onChange }: { profile: Profile; catalog: Catalog; deployments?: DeploymentsResponse; disabled: boolean; onChange: (profile: Profile) => void }) {
  const [items, setItems] = useState<string[]>([]), [quantity, setQuantity] = useState<number | null>(1);
  const [action, setAction] = useState<'notify' | 'pause'>('notify');
  const [chosen, setChosen] = useState<string[] | null>(null);
  const farmers = profile.characters.filter(c => c.ctype !== 'merchant' && c.script.endsWith('-v2'));
  const characters = chosen ?? (profile.seller.teamSupervisor.soloGuard && profile.seller.teamSupervisor.characters.length === 1 ? profile.seller.teamSupervisor.characters : farmers.filter(c => c.enabled).map(c => c.name));
  const update = (lootGoals: Profile['automation']['lootGoals']) => onChange({ ...profile, automation: { ...profile.automation, lootGoals } });
  return <Card title="Loot objectives" className={styles.panel}>
    <p className={styles.help}>Count newly looted items from the selected farmers, excluding purchases and transfers. Progress survives CODE restarts on the same game browser. Farmers share progress through game messages every ten seconds. Pause stops new farming; healing, potions, loot and self-defence continue.</p>
    <div className={styles.form}>
      <Field label="Loot items" htmlFor="loot-goal-items"><ItemMultiSelect id="loot-goal-items" catalog={catalog} values={items} disabled={disabled} onChange={setItems} /></Field>
      <Field label="Quantity per item" htmlFor="loot-goal-quantity"><NumberInput id="loot-goal-quantity" min={1} max={999999} value={quantity} disabled={disabled} onChange={setQuantity} /></Field>
      <Field label="When reached" htmlFor="loot-goal-action"><SelectInput id="loot-goal-action" value={action} disabled={disabled} onChange={value => setAction(value as typeof action)} options={[{ value: 'notify', label: 'Show completed objective' }, { value: 'pause', label: 'Pause farming' }]} /></Field>
    </div>
    <div className={styles.participants}>{farmers.map(c => <Toggle key={c.name} label={c.name} disabled={disabled} value={characters.includes(c.name)} onChange={enabled => setChosen(enabled ? [...characters, c.name] : characters.filter(name => name !== c.name))} />)}</div>
    <Button disabled={disabled || !items.length || !quantity || !characters.length || profile.automation.lootGoals.length + items.length > 30} onClick={() => { update([...profile.automation.lootGoals, ...items.map(item => ({ id: crypto.randomUUID(), enabled: true, item, quantity: quantity!, characters, action }))]); setItems([]); }}>Add objectives</Button>
    <div className={styles.rules}>{profile.automation.lootGoals.map(goal => {
      const reports = goal.characters.map(name => deployments?.characters[name]?.telemetry).filter(t => t?.live).flatMap(t => t?.runtimePolicy?.goals.filter(g => g.id === goal.id) ?? []);
      const count = Math.max(0, ...reports.map(g => g.count));
      const start = Math.min(...reports.map(g => g.startedAt ?? Infinity));
      const lastSeen = Math.max(0, ...goal.characters.map(name => deployments?.characters[name]?.telemetry?.lastSeen ?? 0));
      const elapsed = (lastSeen - start) / 60000;
      const eta = count > 0 && Number.isFinite(elapsed) && elapsed >= 5 ? Math.ceil(elapsed * Math.max(0, goal.quantity - count) / count) : null;
      return <article key={goal.id} className={styles.rule}>
        <div className={styles.metric}><Sprite id={`item:${goal.item}`} catalog={catalog} label={goal.item} size={30} /><strong>{goal.item}</strong><Badge variant={count >= goal.quantity ? 'success' : 'info'}>{count} / {goal.quantity}</Badge><span>{goal.characters.join(', ')} · {goal.action}</span></div>
        <p>{!reports.length ? 'Awaiting deployment / live progress.' : reports.some(r => !r.supported) ? 'Loot events unavailable in this runtime.' : count >= goal.quantity ? 'Objective completed.' : 'Collecting loot.'}</p>
        {goal.activityId ? <p>Activity contract: {profile.automation.activities.find(activity => activity.id === goal.activityId)?.name ?? goal.activityId}. Editing this run does not change the saved activity template.</p> : null}
        {eta !== null && <p>Estimated remaining: {eta} min · extrapolated from drops since activation, including downtime; rare drops have high uncertainty.</p>}
        <div className={styles.form}><Field label="Target quantity" htmlFor={`loot-target-${goal.id}`}><NumberInput id={`loot-target-${goal.id}`} min={1} max={999999} value={goal.quantity} disabled={disabled} onChange={n => n !== null && update(profile.automation.lootGoals.map(g => g.id === goal.id ? { ...g, quantity: n } : g))} /></Field><Field label="Completion action" htmlFor={`loot-action-${goal.id}`}><SelectInput id={`loot-action-${goal.id}`} value={goal.action} disabled={disabled} onChange={value => update(profile.automation.lootGoals.map(g => g.id === goal.id ? { ...g, action: value as 'notify' | 'pause' } : g))} options={[{ value: 'notify', label: 'Show completed objective' }, { value: 'pause', label: 'Pause farming' }]} /></Field></div>
        <div className={styles.actions}><Toggle label="Enabled" value={goal.enabled} disabled={disabled} onChange={enabled => update(profile.automation.lootGoals.map(g => g.id === goal.id ? { ...g, enabled } : g))} /><Button variant="ghost" disabled={disabled} onClick={() => update(profile.automation.lootGoals.map(g => g.id === goal.id ? { ...g, id: crypto.randomUUID() } : g))}>New run</Button><Button variant="ghost" disabled={disabled} onClick={() => update(profile.automation.lootGoals.filter(g => g.id !== goal.id))}>Remove</Button></div>
      </article>;
    })}</div>
  </Card>;
}
