/**
 * @file party.ts
 * Domain types for party members and their runtime status.
 * These mirror the shape of data coming from the Command Center WebSocket / REST API.
 */

/** Character classes available in Adventure Land. */
export type CharacterClass = 'warrior' | 'priest' | 'ranger' | 'merchant' | 'mage' | 'rogue' | 'paladin';

/** Coarse operational status of a character. */
export type CharacterStatus =
  | 'online'   // Fresh telemetry without inferring activity.
  | 'farming'   // Actively killing mobs
  | 'support'   // Healing / buffing
  | 'dps'       // Ranged damage dealer
  | 'town'      // Idle in town / stand open
  | 'dumping'   // Travelling to mule to offload items
  | 'hunting'   // On a Daisy contract hunt
  | 'dead'      // RIP — waiting for respawn
  | 'disabled'  // Present in the saved profile but intentionally inactive
  | 'offline';  // Not connected

import type { InventoryItem, EquipmentItem, StandItem, RuntimeIntent, MovementWatchdogStatus, ActiveEffect } from './deployments';

/** Snapshot of a single party member's runtime state. */
export interface PartyMember {
  /** In-game character name. */
  name: string;
  /** Human-readable class label. */
  class: CharacterClass;
  /** Base in-game skin when live telemetry supplies it. */
  skin: string | null;
  /** Current operational status. */
  status: CharacterStatus;
  /** Current HP (0–maxHp). */
  hp: number | null;
  /** Maximum HP. */
  maxHp: number | null;
  /** Current MP (0–maxMp). */
  mp: number | null;
  /** Maximum MP. */
  maxMp: number | null;
  /** Gold held in inventory. */
  gold: number | null;
  /** Current character XP. */
  xp: number | null;
  /** Effective live multipliers (1.0 = 100%). */
  goldMultiplier: number | null;
  luckMultiplier: number | null;
  xpMultiplier: number | null;
  /** Active game status effects, including elixirs and Lone Wolf. */
  activeEffects: ActiveEffect[];
  positionHistory: Array<{ at: number; map: string; server: string; x: number; y: number }>;
  /** Free inventory slots remaining. */
  freeSlots: number | null;
  /** Occupied inventory items. */
  inventory: InventoryItem[];
  /** Equipped items. */
  equipment: EquipmentItem[];
  /** Merchant stand listings or buy orders when applicable. */
  stand: StandItem[];
  /** Active monster hunt contract if available. */
  hunt: { id: string; count: number; ms?: number } | null;
  /** Current map name. */
  map: string | null;
  /** Current world coordinates from live telemetry. */
  x: number | null;
  y: number | null;
  /** Current character level when live telemetry is available. */
  level: number | null;
  /** Current target identifier when one is selected. */
  target: string | null;
  /** Configured execution environment. */
  runtime: 'browser' | 'caracal';
  /** Configured script ID (e.g. eadroma-warrior-v2). */
  script: string;
  /** Last deployment stage reported by the server. */
  deploymentStage: string | null;
  /** Latest explicit script intent captured from set_message(). */
  intent: RuntimeIntent | null;
  /** Shared movement watchdog state and its recovery history. */
  movement: MovementWatchdogStatus | null;
}
