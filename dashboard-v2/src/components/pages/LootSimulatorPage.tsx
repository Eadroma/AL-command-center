import { FarmingProfit } from '../automation/FarmingProfit';
import { useMemo, useState } from 'react';
import { Coins, Gauge, PackageOpen, ShieldAlert, Skull, Sparkles } from 'lucide-react';
import type { Catalog, Profile } from '../../types';
import type { DeploymentsResponse } from '../../types';
import { usePerformanceHistory } from '../../hooks/usePerformanceHistory';
import { calibrateLoot } from '../../models/loot-calibration';
import { combatRows } from '../../models/combat';
import { assessSurvival, farmableLootMonsters, simulateLoot } from '../../models/loot-simulator';
import { Badge, Button, Card, EmptyState, Field, NumberInput, SectionHead, SelectInput, Sprite, Toggle, Tooltip } from '../ui';
import styles from './LootSimulatorPage.module.scss';

export interface LootSimulatorPageProps {
  profile?: Profile;
  catalog?: Catalog;
  deployments?: DeploymentsResponse;
  loading: boolean;
}

const integer = (value: number) => Math.round(value || 0).toLocaleString();
const decimal = (value: number, digits = 1) => (value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });

/** Theory-crafting view based on official game data and current-session measured DPS. */
export function LootSimulatorPage({ profile, catalog, deployments, loading }: LootSimulatorPageProps) {
  const measuredHistory = usePerformanceHistory(24);
  const eligibleMonsters = useMemo(() => catalog ? farmableLootMonsters(catalog, profile) : [], [catalog, profile]);
  const [monsterId, setMonsterId] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [dpsOverrides, setDpsOverrides] = useState<Record<string, number | null>>({});
  const [efficiency, setEfficiency] = useState<number | null>(85);
  const [spawnCount, setSpawnCount] = useState<number | null>(4);
  const [luck, setLuck] = useState<number | null>(100);
  const [goldMultiplier, setGoldMultiplier] = useState<number | null>(null);
  const [dynamicSpawns, setDynamicSpawns] = useState<number | null>(1);
  const [homeServer, setHomeServer] = useState(true);
  const [matchBuild, setMatchBuild] = useState(true);
  const resolvedMonsterId = monsterId || eligibleMonsters.find(entry => entry.id === 'crab')?.id || eligibleMonsters[0]?.id;
  const monster = eligibleMonsters.find(entry => entry.id === resolvedMonsterId) ?? eligibleMonsters[0];
  const rows = profile ? combatRows(profile, deployments) : [];
  const supervisor = profile?.seller.teamSupervisor;
  const soloName = supervisor?.soloGuard && supervisor.characters.length === 1 ? supervisor.characters[0] : undefined;
  const participants = rows.map(row => ({
    ...row,
    selected: selected[row.character.name] ?? (!soloName || row.character.name === soloName),
    observedDps: Math.max(0, row.damagePerSecond),
    effectiveDps: Math.max(0, dpsOverrides[row.character.name] ?? Math.round(row.damagePerSecond)),
  }));
  const selectedParticipants = participants.filter(row => row.selected);
  const liveParticipants = participants.filter(row => row.live);
  const teamDps = selectedParticipants.reduce((sum, row) => sum + row.effectiveDps, 0);
  const liveGoldMultiplier = Math.round(100 * ([...selectedParticipants]
    .sort((left, right) => Number(right.character.ctype === 'warrior') - Number(left.character.ctype === 'warrior'))
    .map(row => deployments?.characters[row.character.name]?.telemetry?.stats?.goldMultiplier)
    .find(value => value !== undefined) ?? 1));
  const appliedGoldMultiplier = goldMultiplier ?? liveGoldMultiplier;
  const tankRow = [...selectedParticipants].sort((left, right) => {
    const leftWarrior = left.character.ctype === 'warrior' ? 1 : 0;
    const rightWarrior = right.character.ctype === 'warrior' ? 1 : 0;
    if (leftWarrior !== rightWarrior) return rightWarrior - leftWarrior;
    const leftHp = deployments?.characters[left.character.name]?.telemetry?.stats?.max_hp ?? 0;
    const rightHp = deployments?.characters[right.character.name]?.telemetry?.stats?.max_hp ?? 0;
    return rightHp - leftHp;
  })[0];
  const tankStats = tankRow ? deployments?.characters[tankRow.character.name]?.telemetry?.stats : undefined;
  const tank = tankRow && tankStats ? { name: tankRow.character.name, maxHp: tankStats.max_hp, armor: tankStats.armor ?? 0, resistance: tankStats.resistance ?? 0 } : undefined;
  const healingPerSecond = selectedParticipants.reduce((sum, row) => sum + (row.combat ? row.combat.healing / Math.max(1, row.elapsedSeconds) : 0), 0);
  const simulationInput = catalog ? {
    catalog,
    teamDps,
    efficiencyPercent: efficiency ?? 0,
    spawnCount: spawnCount ?? 1,
    luckPercent: luck ?? 100,
    goldMultiplierPercent: appliedGoldMultiplier,
    homeServer,
    dynamicSpawnsPerHour: dynamicSpawns ?? 1,
  } : null;
  const result = monster && simulationInput ? simulateLoot({
    monster,
    ...simulationInput,
  }) : null;
  const ranking = simulationInput ? eligibleMonsters.map(entry => {
    const simulation = simulateLoot({ monster: entry, ...simulationInput });
    return { monster: entry, simulation, survival: assessSurvival({ monster: entry, killSeconds: simulation.killSeconds, tank, healingPerSecond }) };
  }).sort((left, right) => right.simulation.totalGoldPerHour - left.simulation.totalGoldPerHour) : [];

  const comparableHistory = (measuredHistory.data?.buckets ?? []).filter(bucket => {
    if (!matchBuild) return true;
    const current = deployments?.characters[bucket.character]?.telemetry;
    if (!current?.live || !current.equipment || !current.activeEffects || !bucket.farmContext?.build || !bucket.farmContext.effects) return false;
    const build = JSON.stringify(current.equipment.map(item => [item.slot,item.name,item.level]).sort());
    return bucket.farmContext.build === build && JSON.stringify(bucket.farmContext.effects) === JSON.stringify(current.activeEffects.map(effect => effect.id).sort()) && bucket.farmContext.goldMultiplier === current.stats?.goldMultiplier;
  });
  const calibration = result ? calibrateLoot(comparableHistory, monster?.id ?? '', selectedParticipants.map(row => row.character.name), (result.dpsLimitedKills / Math.max(1, efficiency ?? 85)) * 100) : null;

  if (loading) return <section aria-label="Loot simulator"><EmptyState title="Loading game economy…" /></section>;
  if (!profile || !catalog) return <section aria-label="Loot simulator"><EmptyState title="Simulator unavailable" description="Use Refresh to reload the profile and game catalog." /></section>;
  if (!monster) return <section aria-label="Loot simulator"><EmptyState title="Monster statistics unavailable" description="Refresh the Adventure Land asset catalog first." /></section>;

  return (
    <section aria-label="Loot simulator">
      <SectionHead eyebrow="Theory crafting" title="Loot & gold simulator">
        <Badge variant="info">Official game data</Badge>
      </SectionHead>
      <p className={styles.description}>Estimate one hour of farming from monster data and the DPS measured during each character&apos;s current CODE session.</p>

      <div className={styles.layout}>
        <div className={styles.controls}>
          <Card title="Target monster" headerActions={<Sprite id={monster.id} catalog={catalog} label={monster.name} size={48} />}>
            <Field label="Monster" htmlFor="sim-monster">
              <SelectInput id="sim-monster" value={monster.id} onChange={setMonsterId} options={eligibleMonsters.map(entry => ({ value: entry.id, label: `${entry.name} · ${entry.id}` }))} />
            </Field>
            <dl className={styles.monsterStats}>
              <div><dt>HP</dt><dd>{integer(monster.hp ?? 0)}</dd></div>
              <div><dt>XP</dt><dd>{integer(monster.xp ?? 0)}</dd></div>
              <div><dt>Attack</dt><dd>{integer(monster.attack ?? 0)}</dd></div>
              <div><dt>Respawn</dt><dd>{(monster.respawn ?? 0) > 0 ? `${decimal(monster.respawn ?? 0, 2)}s` : 'Dynamic'}</dd></div>
            </dl>
          </Card>

          <Card title="Participating characters" headerActions={<Badge>{integer(teamDps)} DPS</Badge>}>
            <div className={styles.partyList}>
              {participants.map(row => (
                <article key={row.character.name} className={row.selected ? styles.participantActive : undefined}>
                  <label className={styles.characterToggle}>
                    <input type="checkbox" checked={row.selected} onChange={event => setSelected(current => ({ ...current, [row.character.name]: event.target.checked }))} />
                    <span><strong>{row.character.name}</strong><small>{row.character.ctype} · {row.live ? 'live' : 'offline'}</small></span>
                  </label>
                  <Field label="DPS used" htmlFor={`sim-dps-${row.character.name}`}>
                    <NumberInput id={`sim-dps-${row.character.name}`} min={0} step={1} value={row.effectiveDps} onChange={value => setDpsOverrides(current => ({ ...current, [row.character.name]: value }))} />
                  </Field>
                  <small className={styles.observed}>Observed: {decimal(row.observedDps)} DPS</small>
                </article>
              ))}
            </div>
            {selectedParticipants.length < liveParticipants.length && (
              <p className={styles.comparisonWarning}>The in-game XP meter includes kills shared by the live party. Select every character contributing to those kills for a comparable projection.</p>
            )}
          </Card>

          <Card title="Simulation assumptions">
            <div className={styles.assumptions}>
              <Field label="Combat efficiency %" htmlFor="sim-efficiency"><NumberInput id="sim-efficiency" min={0} max={100} value={efficiency} onChange={setEfficiency} /></Field>
              <Field label="Spawn count" htmlFor="sim-spawns"><NumberInput id="sim-spawns" min={1} max={1000} value={spawnCount} onChange={setSpawnCount} /></Field>
              <Field label="Luck %" htmlFor="sim-luck"><NumberInput id="sim-luck" min={0} max={10000} value={luck} onChange={setLuck} /></Field>
              <Field label="Gold multiplier %" htmlFor="sim-gold-multiplier"><NumberInput id="sim-gold-multiplier" min={0} max={10000} value={appliedGoldMultiplier} onChange={setGoldMultiplier} /><small className={styles.observed}>Live: {liveGoldMultiplier}%{goldMultiplier === null ? ' · auto' : ' · overridden'}</small></Field>
              <Field label="Dynamic spawns / hour" htmlFor="sim-dynamic-spawns"><NumberInput id="sim-dynamic-spawns" min={0} max={1000} value={dynamicSpawns} onChange={setDynamicSpawns} /></Field>
              <Toggle label="Home-server drops" value={homeServer} onChange={setHomeServer} />
            </div>
          </Card>
        </div>

        {result && <div className={styles.results}>
          <div className={styles.metrics}>
            <Card title="Kills / hour" headerActions={<Skull size={18} />}><strong>{integer(result.killsPerHour)}</strong><small>{decimal(result.killSeconds, 2)}s combat per kill</small></Card>
            <Card title="Base team XP / hour" headerActions={<Sparkles size={18} />}><strong>{integer(result.xpPerHour)}</strong><small>{selectedParticipants.length} selected contributor{selectedParticipants.length === 1 ? '' : 's'} · before personal XP bonuses</small></Card>
            <Card title="Gold / hour" headerActions={<Coins size={18} />}><strong>{integer(result.totalGoldPerHour)}</strong><small>{integer(result.directGoldPerHour)} direct at {appliedGoldMultiplier}% · {integer(result.npcGoldPerHour)} NPC value</small></Card>
            <Card title="Effective DPS" headerActions={<Gauge size={18} />}><strong>{integer(result.effectiveDps)}</strong><small>{efficiency ?? 0}% of {integer(teamDps)} configured DPS</small></Card>
          </div>

          <Card title="Calibration · last 24 hours">
            <Toggle label="Match current equipment, buffs and gold multiplier" value={matchBuild} onChange={setMatchBuild} />
            <p>{matchBuild ? "Only matching reports from updated bundles qualify; legacy samples without equipment evidence are excluded." : "Mixed equipment and buff history: differences may reflect changes in your setup."}</p>
            {measuredHistory.error ? <p role="alert">{measuredHistory.error.message}</p> : calibration ? <>
              <p>Measured loot: <strong>{integer(calibration.goldPerHour)} gold/h</strong> · Simulation direct gold: {integer(result.directGoldPerHour)} gold/h · Difference: {result.directGoldPerHour > 0 ? decimal((calibration.goldPerHour / result.directGoldPerHour - 1) * 100) + '%' : '—'}</p>
              <p>{calibration.observedMinutes} minutes minimum coverage per character · {integer(calibration.killsPerHour)} kills/h · {calibration.deaths} deaths · {decimal(calibration.movingPercent)}% moving</p>
              <Button disabled={calibration.efficiency === null} onClick={() => setEfficiency(calibration.efficiency)}>Use measured efficiency ({calibration.efficiency ?? '—'}%)</Button>
              <p>Target and game-party composition must match. Shared kill credits use the highest character rate. Item resale value is excluded from the comparison. Buffs, server bonuses and jackpot variance can still explain differences; measurements are sampled context, not per-monster receipts.</p>
            </> : <p>{measuredHistory.isLoading ? 'Loading measurements…' : 'Collect at least five minutes of loot coverage for every selected character with this target and exact game-party composition. Older or unknown-context measurements are excluded.'}</p>}
          </Card>

          <Card title="Farmable mobs ranked by gold / hour" headerActions={<Badge>{ranking.length} mobs</Badge>}>
            <div className={styles.rankingHead} aria-hidden="true"><span>#</span><span>Monster</span><span>Gold / hour</span><span>Kills / hour</span><span>XP / hour</span><span>Risk</span></div>
            <div className={styles.rankingList}>
              {ranking.map((entry, index) => (
                <button key={entry.monster.id} type="button" className={entry.monster.id === monster.id ? styles.rankingActive : undefined} onClick={() => setMonsterId(entry.monster.id)}>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.rankingMonster}><Sprite id={entry.monster.id} catalog={catalog} label={entry.monster.name} size={34} /><span><strong>{entry.monster.name}</strong><small>{entry.monster.id}{(entry.monster.respawn ?? 0) <= 0 ? ' · dynamic' : ''}</small></span></span>
                  <strong>{integer(entry.simulation.totalGoldPerHour)}</strong>
                  <span>{integer(entry.simulation.killsPerHour)}</span>
                  <span>{integer(entry.simulation.xpPerHour)}</span>
                  <span>{entry.survival.warning ? <Tooltip content={`${entry.survival.reason}. One engaged monster is assumed.`}><Badge variant="warning"><ShieldAlert size={13} /> Death risk</Badge></Tooltip> : entry.survival.unknown ? <Badge variant="neutral">Unknown</Badge> : <Badge variant="success">Sustainable</Badge>}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Expected monster drops" headerActions={<Badge>{result.drops.length} entries</Badge>}>
            {result.drops.length === 0 ? <EmptyState title="No monster-specific drops" /> : <div className={styles.dropList}>
              {result.drops.map((drop, index) => (
                <article key={`${drop.item}:${drop.homeServer}:${index}`}>
                  <Sprite id={`item:${drop.item}`} catalog={catalog} label={drop.name} size={42} />
                  <div><strong>{drop.name}</strong><small>{drop.item}{drop.homeServer ? ' · home server' : ''}</small></div>
                  <div><strong>{decimal(drop.unitsPerHour, drop.unitsPerHour < 10 ? 2 : 1)} / h</strong><small>{decimal(drop.chancePercent, 4)}% per kill</small></div>
                  <div><strong>{integer(drop.npcGoldPerHour)} gold</strong><small>estimated NPC value</small></div>
                </article>
              ))}
            </div>}
          </Card>

          <div className={styles.notes}>
            <PackageOpen size={18} />
            <p><strong>Scope of the estimate.</strong> This is a long-run expected value for regular mobs supported by the farming scripts. Events and recurring bosses are excluded from the selector and ranking. The in-game meters extrapolate actual gains since CODE started, so one early jackpot can make their Gold/hour much higher. Risk compares one monster&apos;s mitigated DPS with the selected tank&apos;s live armor/resistance, HP, measured healing and kill time. Global, map, exchange, personal XP bonuses and market values are excluded.</p>
            {result.spawnLimitedKills !== null && result.spawnLimitedKills < result.dpsLimitedKills && <Tooltip content="More DPS will not increase kills until more spawn points are available."><Badge variant="warning">Spawn limited</Badge></Tooltip>}
          </div>
        </div>}
      </div>
      <FarmingProfit buckets={(measuredHistory.data?.buckets ?? []).filter(bucket => bucket.farmContext?.monster === monster.id && selectedParticipants.some(row => row.character.name === bucket.character) && JSON.stringify([...bucket.farmContext.participants].sort()) === JSON.stringify(selectedParticipants.map(row => row.character.name).sort()))} />
    </section>
  );
}
