import { useMemo, useState } from 'react';
import { canonicalItemId, classSkills, emptyCharacterLoadouts, loadoutOptions, kitSlots, type FarmStyle, type Profile } from '../../../shared/schema';
import type { Catalog } from '../../types';
import type { PartyMember } from '../../types/party';
import { isValidItemId, setLoadoutGear, toggleLoadoutSkill } from '../../models/farming';
import { EQUIPMENT_SLOTS } from '../../models/inventory';
import { Button, Field, ItemMultiSelect, NumberInput, SelectInput, Sprite, TextInput } from '../ui';
import styles from './FarmLoadouts.module.scss';

export interface FarmLoadoutsProps {
  profile: Profile;
  catalog: Catalog;
  members?: PartyMember[] | null;
  pending: boolean;
  onChange: (profile: Profile) => void;
}

const SLOT_OPTIONS = kitSlots.map(slot => ({ value: slot, label: slot }));

/** Edit gear and skill boards independently for every combat style and farmer. */
export function FarmLoadouts({ profile, catalog, members, pending, onChange }: FarmLoadoutsProps) {
  const farmers = profile.characters.filter(character => character.ctype !== 'merchant');
  const [name, setName] = useState(farmers[0]?.name ?? '');
  const [requestedStyle, setStyle] = useState<FarmStyle>('aoe');
  const options = loadoutOptions(profile);
  const style = options.some(option => option.value === requestedStyle) ? requestedStyle : 'aoe';
  const [newName, setNewName] = useState('');
  const [slot, setSlot] = useState<(typeof kitSlots)[number]>('mainhand');
  const [item, setItem] = useState('');
  const [minLevel, setMinLevel] = useState<number | null>(0);
  const farmer = farmers.find(character => character.name === name) ?? farmers[0];

  const itemNames = useMemo(() => new Map(catalog.items.map(entry => [entry.id, entry.name])), [catalog.items]);
  if (!farmer) return null;
  const board = profile.farming.loadouts[farmer.name] ?? emptyCharacterLoadouts();
  const current = board[style] ?? emptyCharacterLoadouts().aoe;
  const canCreate = isValidItemId(newName) && !['__proto__', 'constructor', 'prototype'].includes(newName) && options.length < 33 && !options.some(option => option.value === newName);
  function createLoadout() {
    if (!canCreate) return;
    const base = ['aoe', 'mono', 'tank'].includes(style) ? style : board[style]?.base ?? 'aoe';
    const loadouts = { ...profile.farming.loadouts };
    for (const character of farmers) {
      const own = loadouts[character.name] ?? emptyCharacterLoadouts();
      loadouts[character.name] = { ...own, [newName]: { ...structuredClone(own[style] ?? own[base]), base: base as 'aoe' | 'mono' | 'tank' } };
    }
    onChange({ ...profile, farming: { ...profile.farming, loadouts } });
    setStyle(newName); setNewName('');
  }
  const liveEquipment = members?.find(member => member.name === farmer.name)?.equipment ?? [];
  const skills = classSkills[farmer.ctype] ?? [];
  const validItem = isValidItemId(item);
  const slotTaken = current.gear.some(entry => entry.slot === slot);

  function selectEquipmentSlot(nextSlot: string) {
    if (!kitSlots.includes(nextSlot as (typeof kitSlots)[number])) return;
    const supportedSlot = nextSlot as (typeof kitSlots)[number];
    const configured = current.gear.find(entry => entry.slot === supportedSlot);
    const equipped = liveEquipment.find(entry => entry.slot === supportedSlot);
    setSlot(supportedSlot);
    setItem(configured?.item ?? equipped?.name ?? '');
    setMinLevel(configured?.minLevel ?? equipped?.level ?? 0);
  }

  function addGear() {
    if (!validItem || slotTaken) return;
    onChange(setLoadoutGear(profile, farmer.name, style, { slot, item, minLevel: minLevel ?? 0 }, slot));
    setItem('');
  }

  return (
    <section className={styles.panel} aria-labelledby="farm-loadouts-title">
      <div className={styles.heading}>
        <div><span>Per character</span><h3 id="farm-loadouts-title">Combat loadouts</h3></div>
        <strong>{current.gear.length} gear · {current.skills.length} skills</strong>
      </div>
      <p className={styles.help}>Empty lists keep the script defaults. Once skills are selected, only those skills are enabled for this style.</p>
      <div className={styles.selectors}>
        <Field label="Character" htmlFor="loadout-character">
          <SelectInput id="loadout-character" value={farmer.name} disabled={pending} onChange={setName} options={farmers.map(character => ({ value: character.name, label: `${character.name} · ${character.ctype}` }))} />
        </Field>
        <Field label="Style" htmlFor="loadout-style">
          <SelectInput id="loadout-style" value={style} disabled={pending} onChange={setStyle} options={options} />
        </Field>
      </div>
      <div className={styles.addRow}>
        <Field label="New loadout ID" htmlFor="new-loadout-name"><TextInput id="new-loadout-name" value={newName} disabled={pending} onChange={setNewName} placeholder="e.g. franky_gold" /></Field>
        <Button disabled={pending || !canCreate} onClick={createLoadout}>Clone selected loadout</Button>
      </div>
      <p className={styles.help}>Creates the same build ID for every farmer, copying each character’s selected build. Use letters, numbers, underscores or hyphens.</p>
      <div className={styles.equipmentEditor} aria-label={`${farmer.name} ${style} equipment loadout`}>
        {EQUIPMENT_SLOTS.map(({ id, label }) => {
          const supported = kitSlots.includes(id as (typeof kitSlots)[number]);
          const configured = current.gear.find(entry => entry.slot === id);
          const equipped = liveEquipment.find(entry => entry.slot === id);
          const shownItem = configured?.item ?? equipped?.name;
          const canonicalShownItem = shownItem ? canonicalItemId(shownItem) : '';
          const shownLevel = configured?.minLevel ?? equipped?.level ?? 0;
          const displayName = canonicalShownItem ? (itemNames.get(canonicalShownItem) ?? canonicalShownItem) : '';
          const selected = slot === id;
          const description = supported
            ? `${label}: ${shownItem ? `${displayName} +${shownLevel}${configured ? ' · loadout override' : ' · currently equipped'}` : 'script default'}`
            : `${label}: managed by consumables`;

          return (
            <button
              type="button"
              key={id}
              className={`${styles.equipmentSlot} ${selected ? styles.selectedSlot : ''} ${configured ? styles.overrideSlot : ''} ${!supported ? styles.unsupportedSlot : ''}`}
              disabled={pending || !supported}
              aria-label={description}
              title={description}
              onClick={() => selectEquipmentSlot(id)}
            >
              {shownItem ? <Sprite id={`item:${canonicalShownItem}`} catalog={catalog} label={displayName} size={38} /> : null}
              {shownItem && shownLevel > 0 ? <span className={styles.gearLevel}>+{shownLevel}</span> : null}
              {configured ? <span className={styles.overrideMark} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className={styles.legend}><span><i className={styles.currentLegend} /> Current gear</span><span><i className={styles.overrideLegend} /> Loadout override</span></div>
      <p className={styles.slotHelp}>
        <strong>{SLOT_OPTIONS.find(option => option.value === slot)?.label}</strong>
        {slotTaken ? ' is overridden for this style. Select another item to replace it.' : ' uses the script default until an item is added.'}
      </p>
      <div className={styles.addRow}>
        <Field label="Slot" htmlFor="loadout-slot"><SelectInput id="loadout-slot" value={slot} disabled={pending} onChange={value => setSlot(value as typeof slot)} options={SLOT_OPTIONS} /></Field>
        <Field label="Item" htmlFor="loadout-item"><ItemMultiSelect id="loadout-item" catalog={catalog} values={item ? [item] : []} disabled={pending} max={1} onChange={items => setItem(items[0] ?? '')} /></Field>
        <Field label="Minimum +" htmlFor="loadout-level"><NumberInput id="loadout-level" min={0} max={15} value={minLevel} disabled={pending} onChange={setMinLevel} /></Field>
        <div className={styles.gearActions}>
          <Button size="small" variant="secondary" disabled={pending || !validItem} onClick={addGear}>{slotTaken ? 'Replace gear' : 'Add gear'}</Button>
          {slotTaken ? <Button size="small" variant="ghost" disabled={pending} onClick={() => onChange(setLoadoutGear(profile, farmer.name, style, null, slot))}>Remove</Button> : null}
        </div>
      </div>
      {current.gear.length === 0 ? <p className={styles.empty}>No gear override for this style.</p> : null}
      <div className={styles.skills}>
        <div><strong>Skills</strong><span>{current.skills.length ? 'Selected skills replace the script defaults.' : 'Using script defaults.'}</span></div>
        <div>{skills.map(skill => {
          const selected = current.skills.includes(skill.id);
          return <button type="button" key={skill.id} className={selected ? styles.selected : undefined} disabled={pending} aria-pressed={selected} onClick={() => onChange(toggleLoadoutSkill(profile, farmer.name, style, skill.id))}>{skill.label}<small>{skill.id}</small></button>;
        })}</div>
      </div>
    </section>
  );
}
