import type { Profile, DeploymentsResponse } from '../../types';
import type { z } from 'zod';
import { dangerSchema } from '../../../shared/automation';
import { Badge, Button, Card, Field, NumberInput, SelectInput, Toggle } from '../ui';
import styles from './AutomationPanels.module.scss';

type DangerSettings = z.infer<typeof dangerSchema>;
export function DangerEditor({ value, disabled, onChange, prefix = 'danger' }: { value: DangerSettings; disabled: boolean; onChange: (value: DangerSettings) => void; prefix?: string }) {
  const update = (change: Partial<DangerSettings>) => onChange({ ...value, ...change });
  return <>
    <div className={styles.participants}><Toggle label="Enable danger management" value={value.enabled} disabled={disabled} onChange={enabled => update({ enabled })} /><Toggle label="Require a nearby priest" value={value.requirePriest} disabled={disabled} onChange={requirePriest => update({ requirePriest })} /></div>
    <div className={styles.form}>
      <Field label="Maximum attackers" htmlFor={`${prefix}-attackers`}><NumberInput id={`${prefix}-attackers`} min={1} max={30} value={value.maxAttackers} disabled={disabled} onChange={n => n !== null && update({ maxAttackers: n })} /></Field>
      <Field label="Retreat below HP %" htmlFor={`${prefix}-retreat`}><NumberInput id={`${prefix}-retreat`} min={1} max={90} value={value.retreatHpPercent} disabled={disabled} onChange={n => n !== null && update({ retreatHpPercent: n, resumeHpPercent: Math.max(value.resumeHpPercent, n + 1) })} /></Field>
      <Field label="Resume above HP %" htmlFor={`${prefix}-resume`}><NumberInput id={`${prefix}-resume`} min={value.retreatHpPercent + 1} max={100} value={value.resumeHpPercent} disabled={disabled} onChange={n => n !== null && update({ resumeHpPercent: n })} /></Field>
      <Field label="Maximum priest distance" htmlFor={`${prefix}-range`}><NumberInput id={`${prefix}-range`} min={50} max={1000} value={value.healerRange} disabled={disabled} onChange={n => n !== null && update({ healerRange: n })} /></Field>
      <Field label="Safety action" htmlFor={`${prefix}-action`}><SelectInput id={`${prefix}-action`} value={value.action} disabled={disabled} onChange={action => update({ action: action as DangerSettings['action'] })} options={[{ value: 'hold', label: 'Hold · stop new pulls' }, { value: 'town', label: 'Town · retreat, then hold' }]} /></Field>
      <Field label="Death budget per character (0 = unlimited)" htmlFor={`${prefix}-deaths`}><NumberInput id={`${prefix}-deaths`} min={0} max={100} value={value.maxDeaths} disabled={disabled} onChange={n => n !== null && update({ maxDeaths: n })} /></Field>
    </div>
    <Toggle label="Coordinate safety retreats with the farming team" value={value.coordinatedRetreat} disabled={disabled} onChange={coordinatedRetreat => update({ coordinatedRetreat })} />
    <p className={styles.help}>When enabled, fresh safety holds or a reported death from another farmer pause new pulls across the team. Each character uses the configured hold/town action. Messages expire after 20 seconds and apply only to this risk run; self-defence and healing continue.</p>
    <p className={styles.help}>Death budget remains blocked after revival and CODE restarts on the same browser. Reset it or stage a new activity, then save and deploy. Healing and self-defence continue. Counts are per character; this does not stop the whole party.</p>
    <Button variant="ghost" disabled={disabled} onClick={() => update({ runId: crypto.randomUUID() })}>Prepare new risk run</Button>
  </>;
}
export function DangerPanel({ profile, deployments, disabled, onChange }: { profile: Profile; deployments?: DeploymentsResponse; disabled: boolean; onChange: (profile: Profile) => void }) {
  return <Card title="Danger management" className={styles.panel}>
    <p className={styles.help}>Pause new pulls and navigation when HP is low, attackers exceed the limit, or the required priest is absent. Recovery needs healthy HP and three stable seconds. Potions, healing and targeted self-defence remain active. Town attempts are limited to one every 30 seconds.</p>
    <DangerEditor value={profile.automation.dangers} disabled={disabled} onChange={dangers => onChange({ ...profile, automation: { ...profile.automation, dangers } })} />
    {profile.characters.filter(c => c.enabled && c.ctype !== 'merchant').map(c => {
      const telemetry = deployments?.characters[c.name]?.telemetry, danger = telemetry?.runtimePolicy?.danger;
      return <p className={styles.metric} key={c.name}><strong>{c.name}</strong><Badge variant={!telemetry?.live ? 'neutral' : danger?.active ? 'danger' : 'success'}>{!telemetry?.live ? 'Offline' : !danger ? 'Rebuild to enable diagnostics' : danger.active ? danger.reason : 'Safe'}</Badge>{danger && telemetry?.live && <span>{Math.round(danger.hpPercent)}% HP · {danger.attackers} attackers · {Math.round(danger.incomingDps)} damage/s · {Math.round(danger.healingDps)} healing/s{danger.deathLimit ? ` · Death budget ${danger.deaths ?? 0}/${danger.deathLimit}` : ''}</span>}</p>;
    })}
  </Card>;
}
