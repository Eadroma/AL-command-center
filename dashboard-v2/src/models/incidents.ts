import type { DeploymentsResponse, Incident, IncidentKind, IncidentSeverity, Profile } from '../types';

interface Occurrence {
  character: string;
  kind: IncidentKind;
  severity: IncidentSeverity;
  title: string;
  details: string;
  at: number;
}

const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 180);

/** Small deterministic hash keeps incident IDs stable without exposing log text in API paths. */
function idFor(occurrence: Occurrence) {
  const value = `${occurrence.character}|${occurrence.kind}|${normalized(occurrence.title).toLowerCase()}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `incident-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Build a grouped incident board from the latest deployment and runtime evidence. */
export function incidentBoard(deployments?: DeploymentsResponse, resolutions: Record<string, number> = {}, profile?: Profile): Incident[] {
  const occurrences: Occurrence[] = [];
  for (const [character, deployment] of Object.entries(deployments?.characters ?? {})) {
    const telemetry = deployment.telemetry;
    if (telemetry?.live && telemetry.runtimePolicy?.danger.active) occurrences.push({ character, kind: 'runtime', severity: 'warning', title: 'Safety hold', details: telemetry.runtimePolicy.danger.reason, at: telemetry.runtimePolicy.diagnostic.updatedAt });
    for (const goal of telemetry?.live ? telemetry.runtimePolicy?.commerce ?? [] : []) if (goal.state.includes('Unconfirmed') || goal.state === 'budget exhausted') occurrences.push({ character, kind: 'commerce', severity: 'warning', title: `Production blocked: ${goal.item}`, details: goal.state, at: telemetry?.lastSeen || 0 });
    for (const row of telemetry?.live ? telemetry.upgradeProduction ?? [] : []) if (row.pending && row.reviewReason) occurrences.push({ character, kind: 'commerce', severity: 'warning', title: `Transaction needs review: ${row.item}`, details: row.reviewReason, at: (row.reviewAt ?? row.action?.at ?? telemetry?.lastSeen ?? 0) + 60000 });
    for (const hold of telemetry?.live ? telemetry.loopGuard?.holds ?? [] : []) occurrences.push({ character, kind: 'commerce', severity: 'warning', title: `Task suspended: ${hold.task}`, details: hold.reason, at: hold.at });
    for (const mission of telemetry?.eventExpedition?.history ?? []) {
      if (mission.phase === 'blocked') occurrences.push({ character, kind: 'commerce', severity: 'warning', title: `Expedition cleanup incomplete: ${mission.event}`, details: mission.reason, at: mission.finishedAt });
      if (mission.engagedAt && mission.finishedAt - mission.engagedAt >= 30000) for (const worker of mission.participants) if (worker.metrics?.bossHits === 0) occurrences.push({ character: worker.name, kind: 'runtime', severity: 'warning', title: `No confirmed boss attack: ${mission.event}`, details: `Mission ${mission.id}: last worker report contains no hit attributed to the boss. Missing entity visibility may limit attribution.`, at: mission.finishedAt });
    }
    for (const failure of telemetry?.failures ?? []) {
      occurrences.push({ character, kind: 'death', severity: 'error', title: failure.reason, details: failure.details, at: failure.at });
    }
    const movement = telemetry?.movement;
    if (movement && (movement.recoveries > 0 || ['stalled', 'recovering', 'blocked'].includes(movement.state))) {
      occurrences.push({
        character, kind: 'movement', severity: movement.state === 'blocked' ? 'error' : 'warning',
        title: movement.state === 'blocked' ? 'Movement recovery blocked' : 'Movement recovery',
        details: movement.lastAction || `${movement.attempts} recovery attempts in the current session.`, at: movement.updatedAt,
      });
    }
    for (const entry of telemetry?.logs ?? []) {
      if (!/^ERROR:/i.test(entry.message)) continue;
      const message = normalized(entry.message.replace(/^ERROR:\s*/i, ''));
      if (!message || message === '[object Object]') continue;
      occurrences.push({ character, kind: 'runtime', severity: 'error', title: message.split(' — ')[0] || 'Runtime error', details: message, at: entry.time });
    }
    const stage = String(deployment.stage || '');
    if (/failed/i.test(stage) || /stale/i.test(stage)) {
      occurrences.push({
        character, kind: 'deployment', severity: /failed/i.test(stage) ? 'error' : 'warning', title: stage,
        details: deployment.message || (stage.includes('stale') ? 'No fresh telemetry report was received for this deployment.' : 'Deployment did not complete.'),
        at: Date.parse(deployment.updatedAt || '') || telemetry?.lastSeen || 0,
      });
    }
    if (telemetry?.live && (telemetry.inventory?.length ?? 0) >= 38) {
      const occupied = telemetry.inventory?.length ?? 0;
      occurrences.push({ character, kind: 'inventory', severity: occupied >= 41 ? 'error' : 'warning', title: 'Inventory almost full', details: `${occupied}/42 slots occupied · ${42 - occupied} remaining.`, at: telemetry.lastSeen || 0 });
    }
  }

  for (const health of deployments?.fleet.characters ?? []) {
    if (!health.sourceDrift && !health.profileDrift) continue;
    const deployment = deployments?.characters[health.name];
    const differences = [health.sourceDrift ? 'local script source' : '', health.profileDrift ? 'saved profile revision' : ''].filter(Boolean).join(' and ');
    occurrences.push({
      character: health.name, kind: 'drift', severity: 'warning', title: 'Deployment drift',
      details: `The deployed build differs from the current ${differences}. Deploy this character to synchronize it.`,
      at: Date.parse(deployment?.updatedAt || '') || deployment?.telemetry?.lastSeen || 0,
    });
  }

  if (profile?.seller.consumables.enabled) {
    for (const rule of profile.seller.consumables.rules) {
      const telemetry = deployments?.characters[rule.character]?.telemetry;
      if (!telemetry?.live) continue;
      const quantity = (telemetry.inventory ?? []).filter(item => item.name === rule.item).reduce((total, item) => total + item.quantity, 0);
      if (quantity < rule.minQty) occurrences.push({
        character: rule.character, kind: 'stock', severity: quantity === 0 ? 'error' : 'warning', title: `Low ${rule.item} stock`,
        details: `${quantity} held · minimum ${rule.minQty} · refill target ${rule.targetQty}.`, at: telemetry.lastSeen || 0,
      });
    }
  }

  if (profile) {
    const supervisor = profile.seller.teamSupervisor;
    const soloName = supervisor.soloGuard && supervisor.characters.length === 1 ? supervisor.characters[0] : '';
    const soloCharacter = soloName ? profile.characters.find(character => character.name === soloName && character.enabled && character.ctype !== 'merchant') : undefined;
    if (soloCharacter) {
      const soloTelemetry = deployments?.characters[soloCharacter.name]?.telemetry;
      const unexpected = profile.characters
        .filter(character => character.ctype !== 'merchant' && character.name !== soloCharacter.name)
        .filter(character => deployments?.characters[character.name]?.telemetry?.live);
      if (unexpected.length) occurrences.push({
        character: soloCharacter.name, kind: 'solo', severity: 'error', title: 'Solo session broken',
        details: `${unexpected.map(character => character.name).join(', ')} also online while ${soloCharacter.name} is the guarded solo character.`,
        at: Math.max(...unexpected.map(character => deployments?.characters[character.name]?.telemetry?.lastSeen || 0)),
      });
      if (soloCharacter.ctype === 'ranger' && soloTelemetry?.live && Array.isArray(soloTelemetry.activeEffects)
        && !soloTelemetry.activeEffects.some(effect => effect.id.toLowerCase().includes('lonewolf'))) {
        occurrences.push({
          character: soloCharacter.name, kind: 'solo', severity: 'warning', title: 'Lone Wolf inactive',
          details: `${soloCharacter.name} is configured for solo farming but the Lone Wolf effect is missing from live telemetry.`, at: soloTelemetry.lastSeen || 0,
        });
      }
    }

    const activeFighters = profile.characters.filter(character => character.enabled && (character.ctype === 'warrior' || character.ctype === 'ranger'))
      .filter(character => deployments?.characters[character.name]?.telemetry?.live);
    const priests = profile.characters.filter(character => character.enabled && character.ctype === 'priest');
    const availablePriest = priests.some(character => {
      const telemetry = deployments?.characters[character.name]?.telemetry;
      return telemetry?.live && (telemetry.stats?.hp ?? 0) > 0;
    });
    const fightersNeedingPriest = activeFighters.filter(character => character.name !== soloCharacter?.name);
    if (fightersNeedingPriest.length && priests.length && !availablePriest) occurrences.push({
      character: priests.map(character => character.name).join(', '), kind: 'availability', severity: 'error', title: 'Priest unavailable',
      details: `${fightersNeedingPriest.map(character => character.name).join(', ')} online without a living priest.`,
      at: Math.max(...activeFighters.map(character => deployments?.characters[character.name]?.telemetry?.lastSeen || 0)),
    });

    const merchant = profile.characters.find(character => character.enabled && character.ctype === 'merchant');
    const telemetry = merchant && deployments?.characters[merchant.name]?.telemetry;
    const intent = telemetry?.intent?.state.toLocaleLowerCase() ?? '';
    if (merchant && profile.seller.standEnabled && profile.seller.listings.length && telemetry?.live && telemetry.standOpen === false
      && telemetry.stats?.map === 'main' && (intent.includes('stand') || intent === 'idle')) {
      occurrences.push({ character: merchant.name, kind: 'commerce', severity: 'warning', title: 'Player stand closed', details: `${profile.seller.listings.length} configured sale listings are waiting while the merchant is idle at main.`, at: telemetry.lastSeen || 0 });
    }
  }

  const grouped = new Map<string, Incident>();
  for (const occurrence of occurrences) {
    const id = idFor(occurrence);
    const current = grouped.get(id);
    if (current) {
      current.occurrences++;
      current.firstAt = Math.min(current.firstAt, occurrence.at);
      if (occurrence.at >= current.lastAt) { current.lastAt = occurrence.at; current.details = occurrence.details; }
      if (occurrence.severity === 'error') current.severity = 'error';
      continue;
    }
    grouped.set(id, { ...occurrence, id, firstAt: occurrence.at, lastAt: occurrence.at, occurrences: 1, resolved: false });
  }
  return [...grouped.values()].map(incident => {
    const resolvedAt = resolutions[incident.id];
    return { ...incident, resolvedAt, resolved: !!resolvedAt && resolvedAt >= incident.lastAt };
  }).sort((left, right) => Number(left.resolved) - Number(right.resolved)
    || Number(right.severity === 'error') - Number(left.severity === 'error') || right.lastAt - left.lastAt);
}
