import { useState } from 'react';
import type { Profile, Catalog, DeploymentsResponse } from '../../types';
import { Badge, Button, Card, Field, ItemMultiSelect, NumberInput, SelectInput, Toggle } from '../ui';
import styles from './AutomationPanels.module.scss';

export function CombatGearPanel({ profile, catalog, deployments, disabled, onChange }: { profile: Profile; catalog: Catalog; deployments?: DeploymentsResponse; disabled: boolean; onChange: (profile: Profile) => void }) {
  const farmers = profile.characters.filter(c => c.ctype !== 'merchant' && c.script.endsWith('-v2'));
  const [character, setCharacter] = useState('');
  const name = character || farmers.find(c => c.enabled && profile.seller.teamSupervisor.characters.includes(c.name))?.name || farmers.find(c => c.enabled)?.name || farmers[0]?.name || '';
  const existing = profile.automation.combatGear.find(r => r.character === name);
  const rule = existing ?? { character: name, enabled: false, combatItem: 'handofmidas', combatMinLevel: 0, movementItem: '', movementMinLevel: 0 };
  const update = (change: Partial<typeof rule>) => onChange({ ...profile, automation: { ...profile.automation, combatGear: [...profile.automation.combatGear.filter(r => r.character !== name), { ...rule, ...change }] } });
  const gloveCatalog = { ...catalog, items: catalog.items.filter(item => item.id === 'handofmidas' || /glove|grip/.test(item.id)) };
  const telemetry = deployments?.characters[name]?.telemetry;
  const status = telemetry?.runtimePolicy?.combatGear;
  return <Card title="Combat-only gloves · Hand of Midas" className={styles.panel}>
    <p className={styles.help}>Movement always takes priority, including shooting while moving. Combat gloves are worn for a nearby fight while stationary. Outside combat, equip the travel pair or leave the slot empty. This rule owns the glove slot ahead of kit and loadout rules; both pairs stay protected from inventory dumps. Save and deploy to apply.</p>
    <div className={styles.form}>
      <Field label="Character" htmlFor="combat-gear-character"><SelectInput id="combat-gear-character" disabled={disabled} value={name} options={farmers.map(c => ({ value: c.name, label: c.name }))} onChange={setCharacter} /></Field>
      <Toggle label="Combat-only glove switching" disabled={disabled || !name} value={rule.enabled} onChange={enabled => update({ enabled })} />
      <Field label="Combat gloves" htmlFor="combat-gear-item"><ItemMultiSelect id="combat-gear-item" catalog={gloveCatalog} max={1} values={[rule.combatItem]} disabled={disabled} onChange={items => items[0] && update({ combatItem: items[0] })} /></Field>
      <Field label="Combat minimum +" htmlFor="combat-gear-level"><NumberInput id="combat-gear-level" min={0} max={15} value={rule.combatMinLevel} disabled={disabled} onChange={n => n !== null && update({ combatMinLevel: n })} /></Field>
      <Field label="Travel gloves (empty removes combat gloves)" htmlFor="travel-gear-item"><ItemMultiSelect id="travel-gear-item" catalog={gloveCatalog} max={1} values={rule.movementItem ? [rule.movementItem] : []} disabled={disabled} onChange={items => update({ movementItem: items[0] || '' })} /></Field>
      <Field label="Travel minimum +" htmlFor="travel-gear-level"><NumberInput id="travel-gear-level" min={0} max={15} value={rule.movementMinLevel} disabled={disabled} onChange={n => n !== null && update({ movementMinLevel: n })} /></Field>
    </div>
    {status && <p><Badge variant={telemetry?.live ? 'info' : 'neutral'}>{status.phase}</Badge> {status.status}{!telemetry?.live && ' · stale report'}</p>}
    <p className={styles.help}>If the travel pair is missing, remove the combat pair when a bag slot is free. A full bag prevents unequipping and is reported in the combat diagnostic.</p>
    {existing && <Button variant="ghost" disabled={disabled} onClick={() => onChange({ ...profile, automation: { ...profile.automation, combatGear: profile.automation.combatGear.filter(r => r.character !== name) } })}>Remove switching rule</Button>}
  </Card>;
}
