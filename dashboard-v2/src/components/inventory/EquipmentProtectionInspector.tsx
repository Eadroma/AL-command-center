import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { equipmentProtection } from '../../models/equipment-protection';
import { Field, SelectInput, Sprite } from '../ui';
import { CollapsiblePanel } from '../merchant/CollapsiblePanel';
import styles from '../merchant/MerchantTools.module.scss';
export function EquipmentProtectionInspector({ profile, deployments, catalog }: { profile?: Profile; deployments?: DeploymentsResponse; catalog?: Catalog }) {
  const [selected, setSelected] = useState('');
  if (!profile) return null;
  const farmers = profile.characters.filter(c => c.ctype !== 'merchant');
  const name = farmers.some(c => c.name === selected) ? selected : farmers[0]?.name ?? '';
  const telemetry = deployments?.characters[name]?.telemetry;
  return <CollapsiblePanel id="equipment-protections" title="Equipment protection inspector" eyebrow="Per inventory slot · running policy">
    <Field label="Character" htmlFor="protection-character"><SelectInput id="protection-character" value={name} options={farmers.map(c => ({ value: c.name, label: c.name }))} onChange={setSelected}/></Field>
    <p>{telemetry?.live ? 'Live inventory' : 'Stored inventory · decisions may be outdated'}. Eligibility does not guarantee an immediate handoff. Loadout explanations use the saved profile; the deployed configuration may differ.</p>
    {!telemetry?.inventory?.length && <p>No inventory sample available.</p>}
    <div className={styles.rows}>{telemetry?.inventory?.map(item => {
      const decision = equipmentProtection(profile, name, item);
      return <div className={styles.row} key={item.slot}><Sprite id={`item:${item.name}`} catalog={catalog} label={item.name} size={32}/><span>Slot {item.slot} · {item.name} +{item.level}<br/><strong>{decision.runtime}</strong><br/>{decision.reason}</span></div>;
    })}</div>
  </CollapsiblePanel>;
}
