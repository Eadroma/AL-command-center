import { useState } from 'react';
import type { Profile, Catalog } from '../../types';
import { worldBosses, profileSchema, loadoutOptions } from '../../../shared/schema';
import { activitySchema } from '../../../shared/automation';
import type { z } from 'zod';
import { applyActivity } from '../../models/activities';
import { Badge, Button, Card, Field, ItemMultiSelect, NumberInput, SelectInput, TextInput, Toggle } from '../ui';
import { DangerEditor } from './DangerPanel';
import styles from './AutomationPanels.module.scss';

type Activity = z.infer<typeof activitySchema>;
export function ActivityProfiles({ profile, catalog, disabled, onChange }: { profile: Profile; catalog: Catalog; disabled: boolean; onChange: (profile: Profile) => void }) {
  const create = (): Activity => ({ id: crypto.randomUUID(), name: '', kind: 'farm', monster: profile.farming.defaultMonster, style: 'aoe', characters: profile.seller.teamSupervisor.soloGuard && profile.seller.teamSupervisor.characters.length === 1 ? profile.seller.teamSupervisor.characters : profile.characters.filter(c => c.enabled && c.ctype !== 'merchant').map(c => c.name), hunts: false, events: false, dangers: structuredClone(profile.automation.dangers), builds: {}, consumables: [] });
  const [draft, setDraft] = useState<Activity>(create), [error, setError] = useState(''), [preview, setPreview] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const update = (change: Partial<Activity>) => setDraft({ ...draft, ...change });
  const farmers = profile.characters.filter(c => c.ctype !== 'merchant' && c.script.endsWith('-v2'));
  const targets = draft.kind === 'boss' ? worldBosses.map(b => ({ value: b.id, label: b.name })) : catalog.monsters.map(m => ({ value: m.id, label: `${m.name} · ${m.id}` }));
  const save = () => {
    const parsed = activitySchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues.map(i => i.message).join(' ')); return; }
    if (draft.kind === 'cave' && draft.characters.length !== 3) { setError('Cave Dreams requires exactly three farmers.'); return; }
    const next = profileSchema.safeParse({ ...profile, automation: { ...profile.automation, activities: [...profile.automation.activities.filter(a => a.id !== draft.id), parsed.data] } });
    if (!next.success) { setError(next.error.issues.map(i => i.message).join(' ')); return; }
    onChange(next.data);
    setDraft(create()); setError(''); setEditorOpen(false);
  };
  const plan = (id: string) => {
    try { const next = applyActivity(profile, id); setPreview(id); setError(''); return next; } catch (e) { setError((e as Error).message); return null; }
  };
  return <Card title="Activity profiles" className={styles.panel}>
    <p className={styles.help}>Save a target, team, existing builds, automation and safety settings. Preview then stage an activity; save and deploy to activate it. Stop excluded online farmers from Party. Merchant configuration and stored builds remain intact.</p>
    {profile.automation.activeActivity && <p>Selected activity: {profile.automation.activities.find(a => a.id === profile.automation.activeActivity)?.name ?? profile.automation.activeActivity}. <Button variant="ghost" disabled={disabled} onClick={() => onChange({ ...profile, automation: { ...profile.automation, activeActivity: '', activeBuilds: {}, activeConsumables: [] } })}>Clear activity build / consumable overrides</Button></p>}
    <details open={editorOpen} onToggle={event => setEditorOpen(event.currentTarget.open)}><summary>Create or edit an activity</summary>
    <div className={styles.form}>
      <Field label="Activity name" htmlFor="activity-name"><TextInput id="activity-name" value={draft.name} disabled={disabled} onChange={name => update({ name })} /></Field>
      <Field label="Activity kind" htmlFor="activity-kind"><SelectInput id="activity-kind" value={draft.kind} disabled={disabled} options={[{ value: 'farm', label: 'Farm' }, { value: 'boss', label: 'Recurring boss' }, { value: 'cave', label: 'Cave Dreams' }]} onChange={kind => update({ kind: kind as Activity['kind'], monster: kind === 'boss' ? worldBosses[0].id : kind === 'cave' ? 'crab' : profile.farming.defaultMonster })} /></Field>
      <Field label={draft.kind === 'cave' ? 'Fallback after Cave' : 'Target'} htmlFor="activity-monster"><SelectInput id="activity-monster" value={draft.monster} disabled={disabled} options={targets} onChange={monster => update({ monster })} /></Field>
      <Field label="Default build" htmlFor="activity-style"><SelectInput id="activity-style" value={draft.style} disabled={disabled} options={loadoutOptions(profile)} onChange={style => update({ style: style as Activity['style'] })} /></Field>
    </div>
    <div className={styles.participants}>{farmers.map(c => <Toggle key={c.name} label={c.name} value={draft.characters.includes(c.name)} disabled={disabled} onChange={enabled => update({ characters: enabled ? [...draft.characters, c.name] : draft.characters.filter(name => name !== c.name), builds: Object.fromEntries(Object.entries(draft.builds).filter(([name]) => enabled || name !== c.name)) })} />)}</div>
    <div className={styles.form}>{farmers.filter(c => draft.characters.includes(c.name)).map(c => <Field key={c.name} label={`${c.name} build`} htmlFor={`activity-build-${c.name}`}><SelectInput id={`activity-build-${c.name}`} disabled={disabled} value={draft.builds[c.name] ?? draft.style} options={loadoutOptions(profile)} onChange={style => update({ builds: { ...draft.builds, [c.name]: style as Activity['style'] } })} /></Field>)}</div>
    <div className={styles.participants}><Toggle label="Daisy hunts" value={draft.hunts} disabled={disabled} onChange={hunts => update({ hunts })} /><Toggle label="World events" value={draft.events} disabled={disabled} onChange={events => update({ events })} /></div>
    <Field label="Consumables from existing delivery rules (empty keeps all)" htmlFor="activity-consumables"><ItemMultiSelect id="activity-consumables" catalog={{ ...catalog, items: catalog.items.filter(item => profile.seller.consumables.rules.some(rule => rule.item === item.id)) }} values={draft.consumables} disabled={disabled} onChange={consumables => update({ consumables })} /></Field>
    <Toggle label="Loot farming contract" value={!!draft.contract} disabled={disabled} onChange={enabled => update({ contract: enabled ? { items: [], quantity: 1, action: 'notify' } : undefined })} />
    {draft.contract ? <>
      <p className={styles.help}>Start a fresh loot run when staging this activity. Counts are newly looted items shared by its participants. With multiple items, Pause triggers as soon as any one target is reached. Existing standalone objectives remain active; previous activity contracts are replaced.</p>
      <div className={styles.form}>
        <Field label="Contract loot items" htmlFor="contract-items"><ItemMultiSelect id="contract-items" catalog={catalog} values={draft.contract.items} disabled={disabled} onChange={items => update({ contract: { ...draft.contract!, items } })} /></Field>
        <Field label="Quantity per item" htmlFor="contract-quantity"><NumberInput id="contract-quantity" min={1} max={999999} value={draft.contract.quantity} disabled={disabled} onChange={quantity => quantity !== null && update({ contract: { ...draft.contract!, quantity } })} /></Field>
        <Field label="At target" htmlFor="contract-action"><SelectInput id="contract-action" value={draft.contract.action} disabled={disabled} options={[{ value: 'notify', label: 'Mark complete and keep farming' }, { value: 'pause', label: 'Pause new farming; retain self-defence' }]} onChange={action => update({ contract: { ...draft.contract!, action: action as 'notify' | 'pause' } })} /></Field>
      </div>
    </> : null}
    <details><summary>Activity safety settings</summary><DangerEditor value={draft.dangers} disabled={disabled} onChange={dangers => update({ dangers })} prefix="activity-danger" /></details>
    <div className={styles.actions}><Button disabled={disabled || profile.automation.activities.length >= 30 && !profile.automation.activities.some(a => a.id === draft.id)} onClick={save}>Save activity in draft</Button><Button variant="ghost" disabled={disabled} onClick={() => { setDraft(create()); setError(''); }}>Clear editor</Button></div>
    </details>
    {error && <p role="alert">{error}</p>}
    <div className={styles.rules}>{profile.automation.activities.map(activity => <article key={activity.id} className={styles.rule}>
      <div className={styles.metric}><strong>{activity.name}</strong><Badge>{activity.kind}</Badge>{profile.automation.activeActivity === activity.id && <Badge variant="success">Staged activity</Badge>}</div>
      <p>{activity.characters.join(', ')} · {activity.monster} · {activity.style}</p>
      {activity.contract ? <p>Contract: {activity.contract.items.join(', ')} × {activity.contract.quantity} each · {activity.contract.action}. Stage starts a new run. Progress appears in Loot objectives.</p> : null}
      <div className={styles.actions}><Button disabled={disabled} onClick={() => plan(activity.id)}>Preview</Button><Button variant="ghost" disabled={disabled} onClick={() => { setDraft(structuredClone(activity)); setEditorOpen(true); }}>Edit</Button><Button variant="ghost" disabled={disabled} onClick={() => { onChange({ ...profile, automation: { ...profile.automation, activities: profile.automation.activities.filter(a => a.id !== activity.id) } }); setPreview(''); }}>Remove</Button></div>
      {preview === activity.id && <><p>Leader: {profile.characters.find(c => activity.characters.includes(c.name) && c.ctype === 'warrior')?.name ?? activity.characters[0]}. Merchant stays separate. {activity.hunts ? 'Hunts on.' : 'Hunts off.'} {activity.events ? 'Events on.' : 'Events off.'} Safety: {activity.dangers.enabled ? activity.dangers.action : 'off'}. Builds: {activity.characters.map(name => `${name} → ${activity.builds[name] ?? activity.style}`).join(' · ')}.</p><p>Excluded farmers: {profile.characters.filter(c => c.ctype !== 'merchant' && !activity.characters.includes(c.name)).map(c => c.name).join(', ') || 'none'}. A dedicated crab ranger switches to the general ranger script for other activities.</p><Button disabled={disabled} onClick={() => { const next = plan(activity.id); if (next) { onChange(next); setPreview(''); } }}>Stage this activity</Button></>}
    </article>)}</div>
  </Card>;
}
