import { loadoutOptions } from '../../../shared/schema';
import { WorkspaceSections } from '../layout/WorkspaceSections';
import { useState } from 'react';
import {
  bossCheckIntervals,
  formatDuration,
  worldBosses,
  type FarmStyle,
  type Profile,
} from '../../../shared/schema';
import type { Catalog, DeploymentsResponse } from '../../types';
import { ActivityProfiles } from '../automation/ActivityProfiles';
import { LootGoals } from '../automation/LootGoals';
import { DangerPanel } from '../automation/DangerPanel';
import { CombatGearPanel } from '../automation/CombatGearPanel';
import type { PartyMember } from '../../types/party';
import {
  farmStyle,
  nearestBossInterval,
  setBossChecksEnabled,
  setBossRule,
  setCharacterFarmMonster,
  setDefaultMonster,
  setFarmingFlag,
  setFarmStyle,
  setHuntAllowed,
} from '../../models/farming';
import { FarmLoadouts } from '../farming/FarmLoadouts';
import { Badge, Button, EmptyState, Field, SectionHead, SelectInput, Sprite, TextInput, Toggle } from '../ui';
import styles from './FarmingPage.module.scss';
import { FarmingAdvisor } from '../farming/FarmingAdvisor';
import { DepartureChecklist } from '../farming/DepartureChecklist';
import { SharedEquipmentPlanner } from '../inventory/SharedEquipmentPlanner';

export interface FarmingPageProps {
  deployments?: DeploymentsResponse;
  profile?: Profile;
  catalog?: Catalog;
  version?: number;
  loading: boolean;
  dirty: boolean;
  conflict: boolean;
  pending: boolean;
  deploymentBusy: boolean;
  error?: string;
  notice?: string;
  members?: PartyMember[] | null;
  onChange: (profile: Profile) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDeploy: () => void;
}

const INTERVAL_OPTIONS = bossCheckIntervals.map(minutes => ({ value: String(minutes), label: formatDuration(minutes * 60) }));

/** Full farming profile editor: targets, Daisy hunts, boss timers and loadouts. */
export function FarmingPage({
  profile, catalog, version, loading, dirty, conflict, pending, deploymentBusy,
  error, notice, members, deployments, onChange, onSave, onDiscard, onDeploy,
}: FarmingPageProps) {
  const [search, setSearch] = useState('');
  if (loading) return <section aria-label="Farming configuration"><SectionHead eyebrow="Routes and contracts" title="Farming" /><EmptyState title="Loading farming strategy…" /></section>;
  if (!profile || !catalog) return <section aria-label="Farming configuration"><SectionHead eyebrow="Routes and contracts" title="Farming" /><EmptyState title="Profile unavailable" description="Use Refresh to retry the server connection." /></section>;

  const monsters = catalog.monsters;
  const monsterOptions = monsters.map(monster => ({ value: monster.id, label: `${monster.name} · ${monster.id}` }));
  const needle = search.trim().toLowerCase();
  const filtered = needle ? monsters.filter(monster => `${monster.name} ${monster.id}`.toLowerCase().includes(needle)) : monsters;
  const disabled = pending;
  const canDeploy = !pending && !dirty && !conflict && !deploymentBusy && profile.characters.some(character => character.enabled);
  const defaultName = monsters.find(monster => monster.id === profile.farming.defaultMonster)?.name ?? profile.farming.defaultMonster;

  return (
    <section aria-label="Farming configuration">
      <SectionHead eyebrow="Routes and contracts" title="Farming & hunts">
        <Badge variant={profile.farming.hunts ? 'success' : 'neutral'}>{profile.farming.hunts ? 'Hunts enabled' : 'Hunts paused'}</Badge>
        <Badge variant="info">Revision {version}</Badge>
      </SectionHead>
      <p className={styles.description}>Configure the party fallback target, Daisy allowlist, recurring camp checks and style-specific equipment.</p>
      <WorkspaceSections label="Farming settings" sections={[
        { id: 'routes', label: 'Targets', description: 'Choose the everyday route and per-character destinations.', content: <>
      <FarmingAdvisor profile={profile} catalog={catalog} disabled={disabled} onChange={onChange} />
      <section className={styles.panel} aria-labelledby="farm-general-title">
        <div className={styles.panelHead}><div><span>Everyday route</span><h3 id="farm-general-title">Default farming</h3></div><Sprite id={profile.farming.defaultMonster} catalog={catalog} label={defaultName} size={56} /></div>
        <div className={styles.generalGrid}>
          <Field label="Fallback monster" htmlFor="default-monster"><SelectInput id="default-monster" value={profile.farming.defaultMonster} disabled={disabled} onChange={value => onChange(setDefaultMonster(profile, value, catalog))} options={monsterOptions} /></Field>
          <Field label="Combat style" htmlFor="default-farm-style"><SelectInput id="default-farm-style" value={farmStyle(profile, profile.farming.defaultMonster, catalog)} disabled={disabled} onChange={value => onChange(setFarmStyle(profile, profile.farming.defaultMonster, value as FarmStyle))} options={profile ? loadoutOptions(profile) : []} /></Field>
        </div>
        <div className={styles.switches}>
          <Toggle label="Enable Daisy hunts" value={profile.farming.hunts} disabled={disabled} onChange={value => onChange(setFarmingFlag(profile, 'hunts', value))} />
          <Toggle label="Opportunistic rare visits" value={profile.farming.rareVisits} disabled={disabled} onChange={value => onChange(setFarmingFlag(profile, 'rareVisits', value))} />
          <Toggle label="Daily Cave of Many Dreams" value={profile.farming.dailyDungeon} disabled={disabled} onChange={value => onChange(setFarmingFlag(profile, 'dailyDungeon', value))} />
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="farm-overrides-title">
        <div className={styles.panelHead}><div><span>Independent routes</span><h3 id="farm-overrides-title">Character target overrides</h3></div></div>
        <p className={styles.help}>Use the party default unless a character must farm independently.</p>
        <div className={styles.overrideGrid}>{profile.characters.filter(character => character.ctype !== 'merchant').map(character => {
          const fixed = catalog.scripts.find(script => script.id === character.script)?.config.FIXED_FARM === true;
          const options = [{ value: '', label: `Party default · ${defaultName}` }, ...monsterOptions];
          return <Field key={character.name} label={`${character.name} · ${character.ctype}${fixed ? ' · fixed script route' : ''}`} htmlFor={`farm-target-${character.name}`}><SelectInput id={`farm-target-${character.name}`} value={fixed ? String(catalog.scripts.find(script => script.id === character.script)?.config.DEFAULT_FARM || character.farmMonster) : character.farmMonster} disabled={disabled || !character.enabled || fixed} onChange={value => onChange(setCharacterFarmMonster(profile, character.name, value, catalog))} options={options} /></Field>;
        })}</div>
      </section>


        </> },
        { id: 'activities', label: 'Activity profiles', description: 'Stage reusable settings for a specific activity.', content: <>
      <ActivityProfiles profile={profile} catalog={catalog} disabled={disabled} onChange={onChange} />
        </> },
        { id: 'builds', label: 'Equipment & skills', description: 'Configure combat loadouts and gear changes while travelling.', content: <>
      <FarmLoadouts profile={profile} catalog={catalog} members={members} pending={pending} onChange={onChange} />
      <SharedEquipmentPlanner profile={profile} deployments={deployments} catalog={catalog} />


      <CombatGearPanel profile={profile} catalog={catalog} deployments={deployments} disabled={disabled} onChange={onChange} />
        </> },
        { id: 'objectives', label: 'Loot & safety', description: 'Set loot objectives and the conditions that pause or retreat the team.', content: <>
      <LootGoals profile={profile} catalog={catalog} deployments={deployments} disabled={disabled} onChange={onChange} />
      <DangerPanel profile={profile} deployments={deployments} disabled={disabled} onChange={onChange} />
      <DepartureChecklist profile={profile} deployments={deployments} />
        </> },
        { id: 'bosses', label: 'Recurring bosses', description: 'Choose scheduled camp visits, intervals and combat builds.', content: <>
      <section className={styles.panel} aria-labelledby="boss-checks-title">
        <div className={styles.panelHead}>
          <div><span>On a timer</span><h3 id="boss-checks-title">Recurring boss farming</h3></div>
          <Toggle label="Enable recurring boss checks" value={profile.farming.bossChecks.enabled} disabled={disabled} onChange={value => onChange(setBossChecksEnabled(profile, value))} />
        </div>
        <p className={styles.help}>The party checks each selected camp on its own interval and returns to {defaultName}. Live server announcements remain controlled under Events.</p>
        <p className={styles.help}>Headless Horseman and Gargoyle (Graveyard Rising) are seasonal event bosses without camp respawns. Configure them under <a href="#events">Events &amp; bosses</a>.</p>
        <div className={styles.bossGrid}>{worldBosses.map(boss => {
          const rule = profile.farming.bossChecks.rules.find(entry => entry.boss === boss.id);
          return <article key={boss.id} className={rule ? styles.active : undefined}>
            <Sprite id={boss.id} catalog={catalog} label={boss.name} size={46} />
            <div><strong>{boss.name}</strong><span>{boss.map} · respawn {formatDuration(boss.respawn)}</span></div>
            <Toggle label={`Check ${boss.name}`} value={!!rule} disabled={disabled} onChange={enabled => onChange(setBossRule(profile, boss.id, enabled ? nearestBossInterval(boss.respawn) : null))} />
            <Field label="Check every" htmlFor={`boss-interval-${boss.id}`}><SelectInput id={`boss-interval-${boss.id}`} value={String(rule?.everyMinutes ?? nearestBossInterval(boss.respawn))} disabled={disabled || !rule} onChange={value => onChange(setBossRule(profile, boss.id, Number(value)))} options={INTERVAL_OPTIONS} /></Field>
            <Field label="Combat build" htmlFor={`boss-style-${boss.id}`}><SelectInput id={`boss-style-${boss.id}`} value={farmStyle(profile, boss.id, catalog)} disabled={disabled || !rule} onChange={value => onChange(setFarmStyle(profile, boss.id, value as FarmStyle))} options={profile ? loadoutOptions(profile) : []} /></Field>
          </article>;
        })}</div>
      </section>


        </> },
        { id: 'hunts', label: 'Hunt allowlist', description: 'Choose the monsters accepted for Daisy contracts.', content: <>
      <section className={styles.panel} aria-labelledby="hunt-allowlist-title">
        <div className={styles.panelHead}><div><span>Pick your battles</span><h3 id="hunt-allowlist-title">Hunt allowlist</h3></div><Badge variant="info">{profile.farming.allowedHunts.length} allowed</Badge></div>
        <div className={styles.search}><TextInput aria-label="Search monsters" placeholder="Find a monster…" value={search} onChange={setSearch} /><Button size="small" variant="ghost" disabled={!search} onClick={() => setSearch('')}>Clear</Button></div>
        {filtered.length === 0 ? <EmptyState title="No monsters found" description="Try another name or identifier." /> : (
          <div className={styles.monsterGrid}>{filtered.map(monster => {
            const allowed = profile.farming.allowedHunts.includes(monster.id);
            return <article key={monster.id} className={allowed ? styles.active : undefined}>
              <Sprite id={monster.id} catalog={catalog} label={monster.name} size={42} />
              <div><strong>{monster.name}</strong><span>{monster.id}</span></div>
              <Toggle label={`Allow ${monster.name}`} value={allowed} disabled={disabled} onChange={value => onChange(setHuntAllowed(profile, monster.id, value, catalog))} />
              <Field label="Combat style" htmlFor={`hunt-style-${monster.id}`}><SelectInput id={`hunt-style-${monster.id}`} value={farmStyle(profile, monster.id, catalog)} disabled={disabled || !allowed} onChange={value => onChange(setFarmStyle(profile, monster.id, value as FarmStyle))} options={profile ? loadoutOptions(profile) : []} /></Field>
            </article>;
          })}</div>
        )}
      </section>


        </> },
      ]} />

      {conflict && <p role="alert" className={styles.alert}>The profile changed in another window. Discard local edits before editing again.</p>}
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.actions}>
        <Button onClick={onSave} disabled={pending || !dirty || conflict || deploymentBusy}>Save profile</Button>
        <Button variant="ghost" onClick={onDiscard} disabled={pending || !dirty}>Discard edits</Button>
        <Button variant="secondary" onClick={onDeploy} disabled={!canDeploy}>{pending || deploymentBusy ? 'Operation in progress…' : 'Deploy saved profile'}</Button>
      </div>
    </section>
  );
}
