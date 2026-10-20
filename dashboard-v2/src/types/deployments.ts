import type { UpgradeHistory } from '../../shared/upgrade-history';
export interface RuntimeStats {
  maxXp?: number; cc?: number; attack?: number; frequency?: number; speed?: number; range?: number;
  tracker?: import('../../shared/party-statistics').TrackerSnapshot;
  /** Base character skin reported by the game client. */
  skin?: string;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  map: string;
  gold?: number;
  xp?: number;
  level?: number;
  x?: number;
  y?: number;
  target?: string;
  server?: string;
  armor?: number;
  resistance?: number;
  evasion?: number;
  /** Live game multipliers; 1.59 means 159%. */
  goldMultiplier?: number;
  luckMultiplier?: number;
  xpMultiplier?: number;
}

export interface ActiveEffect {
  id: string;
  /** Remaining effect time reported by the game, when available. */
  ms?: number;
}

export interface CombatMetrics {
  startedAt: number;
  damageDealt: number;
  damageTakenPhysical: number;
  damageTakenMagical: number;
  healing: number;
  manaRestored: number;
  kills: number;
  deaths: number;
  attacks: number;
  potions: number;
  movingMs: number;
  combatMs: number;
  healerCoverageMs: number;
  kiteMoves: number;
}

export interface NetworkMetrics {
  pingMs: number;
  socketConnected: boolean;
}

export interface RuntimeIntent {
  state: string;
  since: number;
  updatedAt: number;
  map: string;
  target?: string;
  destination?: { map: string; x: number; y: number } | null;
  blockedBy?: string | null;
}

export interface MovementWatchdogStatus {
  state: 'idle' | 'monitoring' | 'stalled' | 'recovering' | 'blocked';
  moving: boolean;
  lastProgressAt: number;
  stalledForMs: number;
  attempts: number;
  recoveries: number;
  lastAction: string;
  updatedAt: number;
  destination?: { map: string; x: number; y: number } | null;
  history?: Array<{
    at: number;
    state: string;
    map: string;
    x: number;
    y: number;
    destination?: { map: string; x: number; y: number } | null;
    detail: string;
  }>;
}

export interface DragoldObservation {
  shard: string;
  live: boolean;
  spawnAt: number;
  seenAt: number;
}

export interface DragoldIntel {
  scanner: string;
  currentShard: string;
  startedAt: number;
  observations: DragoldObservation[];
}

export interface BankSortStatus {
  state: 'idle' | 'queued' | 'running' | 'complete' | 'failed';
  phase: string;
  moved: number;
  merged: number;
  total: number;
  updatedAt: number;
  message: string;
  commandId?: string;
}

export interface CaveStatus {
  inside: boolean;
  enabled?: boolean;
  available?: boolean;
  floor?: number;
  remainingMs?: number;
  paused?: boolean;
  amber?: number;
  gold?: number;
  resets?: number;
  last?: string;
}

export interface CombatFailure {
  at: number;
  reason: string;
  details: string;
}

export interface BankItem {
  pack: string;
  slot: number;
  name: string;
  level: number;
  quantity: number;
  category: string;
}

export interface InventoryItem {
  slot: number;
  name: string;
  level: number;
  quantity: number;
  locked: boolean;
  bound: boolean;
  upgradeable: boolean;
  sellable: boolean;
  /** Decision from the running farmer policy; absent in older bundles. */
  transferAllowed?: boolean;
  transferReason?: string;
}

export interface EquipmentItem {
  slot: string;
  name: string;
  level: number;
  quantity: number;
  shiny?: boolean;
}

export interface StandItem {
  slot: number;
  name: string;
  level: number;
  quantity: number;
  price: number;
  buy: boolean;
}

export interface MerchantTransaction {
  id: string;
  kind: string;
  detail: string;
  state: 'running' | 'committed' | 'failed';
  startedAt: number;
  finishedAt: number;
  message: string;
}

export interface BuildItem {
  name: string; level: number; location: 'equipment' | 'bag'; slot: string;
  properties: Record<string, number>;
}
export interface CharacterTelemetry {
  loopGuard?: { task: string; holds: Array<{ task: string; at: number; reason: string }> };
  eventExpedition?: import('../../shared/event-expedition').EventExpeditionStatus;
  compoundProgress?: import('../../shared/compound-progress').CompoundProgress;
  incidentReplays?: import('./incident-replay').IncidentReplay[];
  economy?: { consumablesGold: number; consumed: number; unpriced: number; npcSalesGold?: number };
  buildItems?: BuildItem[];
  runtimePolicy?: import('../../shared/automation').RuntimePolicyStatus;
  live: boolean;
  lastSeen?: number;
  logs?: Array<{ time: number; message: string }>;
  stats?: RuntimeStats;
  positionHistory?: Array<{ at: number; map: string; server: string; x: number; y: number }>;
  activeEffects?: ActiveEffect[];
  /** Gold from this character's loot events, excluding transfers. */
  loot?: { gold: number; items?: import('../../shared/party-statistics').LootCount[] };
  intent?: RuntimeIntent;
  movement?: MovementWatchdogStatus;
  coordination?: {
    role: 'leader' | 'follower';
    mission: { id: string; leader: string; monster: string; map: string; x: number; y: number; targetId: string; phase: string; at: number } | null;
    ready: string[];
    canEngage: boolean;
    updatedAt: number;
  };
  merchantTransactions?: {
    current: MerchantTransaction | null;
    journal: MerchantTransaction[];
    updatedAt: number;
  };
  inventory?: InventoryItem[];
  equipment?: EquipmentItem[];
  stand?: StandItem[];
  /** Explicit runtime stand state; absent on older deployed telemetry builds. */
  standOpen?: boolean;
  bank?: BankItem[];
  bankAt?: number;
  combat?: CombatMetrics;
  network?: NetworkMetrics;
  dragold?: DragoldIntel;
  upgradeHistory?: UpgradeHistory;
  upgradeProduction?: { item: string; runId: string; spent: number; produced: number; quantity: number; budget: number; pending: boolean; reviewReason?: string; reviewAt?: number; action?: UpgradeHistory['entries'][number]; unbounded?: boolean }[];
  bankSort?: BankSortStatus;
  bankHub?: import('../../shared/bank-hub').BankHub;
  cave?: CaveStatus;
  hunt?: { id: string; count: number; ms?: number } | null;
  failures?: CombatFailure[];
}

export interface CharacterDeployment {
  telemetry?: CharacterTelemetry | null;
  stage?: string;
  message?: string;
  busy?: boolean;
  runtime?: string;
  script?: string;
  hash?: string;
  sourceHash?: string;
  profileVersion?: number;
  updatedAt?: string;
  telemetryId?: string;
  browserStatus?: { code_running?: boolean };
  headless?: { managed?: boolean; processRunning?: boolean };
  character?: string;
}

export interface DeploymentsResponse {
  configured: boolean;
  caracalAvailable: boolean;
  profileVersion: number;
  profileServer: { region: string; name: string };
  policy: unknown;
  fleet: {
    ready?: boolean;
    summary?: string;
    issues: Array<string | { character: string; message: string }>;
    characters?: Array<{
      name: string;
      sourceDrift: boolean;
      profileDrift: boolean;
      realmMismatch: boolean;
      needsRebuild: boolean;
      issues: string[];
    }>;
    enabled?: number;
    live?: number;
    needsRebuild?: number;
    realmMismatches?: number;
  };
  characters: Record<string, CharacterDeployment>;
}
