/**
 * @file PartyMemberRow.tsx
 * Renders a single party member row inside the PartyPanel.
 *
 * Displays the character's name, class label, a status badge,
 * and a dual HP/MP progress bar. Designed to be composed inside a list —
 * it carries no layout responsibility of its own.
 */

import { DecisionExplanation } from './DecisionExplanation';
import type { CharacterTelemetry } from '../../types/deployments';
import { useState } from 'react';
import { Badge, Sprite } from '../ui';
import { ResourceBar } from '../ui/ResourceBar';
import type { Catalog } from '../../types';
import type { PartyMember, CharacterStatus } from '../../types/party';
import { CharacterInventoryCard } from '../inventory/CharacterInventoryCard';
import styles from './PartyMemberRow.module.scss';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps each operational status to a Badge variant for consistent colouring. */
const STATUS_VARIANT: Record<CharacterStatus, 'success' | 'info' | 'neutral' | 'warning' | 'danger'> = {
  online: 'success',
  farming:  'success',
  support:  'success',
  dps:      'info',
  town:     'neutral',
  dumping:  'warning',
  hunting:  'info',
  dead:     'danger',
  disabled: 'neutral',
  offline:  'neutral',
};

/** Human-readable label for each status (Title Case). */
const STATUS_LABEL: Record<CharacterStatus, string> = {
  online: 'Online',
  farming:  'Farming',
  support:  'Support',
  dps:      'DPS',
  town:     'Town',
  dumping:  'Dumping',
  hunting:  'Hunting',
  dead:     'RIP',
  disabled: 'Disabled',
  offline:  'No live telemetry',
};

export interface PartyMemberRowProps {
  telemetry?: CharacterTelemetry;
  /** Full party member snapshot from the API / WebSocket feed. */
  member: PartyMember;
  /** Local sprite catalog; remote game assets are never loaded by the row. */
  catalog?: Catalog;
  /** Trigger deployment of this character's CODE. */
  onDeploy?: (name: string) => void;
  /** Stop CODE execution on this character. */
  onStop?: (name: string) => void;
  /** Change the assigned script for this character. */
  onChangeScript?: (characterName: string, scriptId: string) => void;
}

/**
 * PartyMemberRow
 *
 * One row in the party roster. Shows:
 *   - Character name + class tag on the left
 *   - Status badge on the right
 *   - HP and MP bars stacked below
 *   - Gold, free slots, map, stage info
 *   - Interactive inventory inspection drawer & deploy/stop actions
 */
export function PartyMemberRow({ member, telemetry, catalog, onDeploy, onStop, onChangeScript }: PartyMemberRowProps) {
  const [showInventory, setShowInventory] = useState(false);
  const { name, class: cls, status, hp, maxHp, mp, maxMp, gold, freeSlots, inventory } = member;
  const exactSkin = member.skin ? `skin:${member.skin}` : '';
  const spriteId = exactSkin && catalog?.assets[exactSkin] ? exactSkin : cls;

  const hasInventoryData = (inventory && inventory.length > 0) || (member.equipment && member.equipment.length > 0);
  const isOnline = status !== 'offline' && status !== 'disabled';
  const compatibleScripts = (catalog?.scripts ?? []).filter(
    s => s.ctype === cls || (cls === 'merchant' && s.id === 'stand-sell') || (s.ctype === 'utility' && s.id === 'stand-sell')
  );


  return (
    <li className={styles.row} data-status={status}>
      <div className={styles.portrait}>
        <Sprite id={spriteId} catalog={catalog} label={`${name} character sprite`} size={48} />
      </div>
      <div className={styles.identity}>
        <span className={styles.name}>{name}</span>
        <span className={styles.cls}>{cls}</span>
      </div>
      <div className={styles.statusActions}>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
        {isOnline && onStop && (
          <button
            type="button"
            className={styles.invToggle}
            data-usage="action.stop" title={`Stop CODE on ${name}`}
            onClick={() => onStop(name)}
          >
            Stop
          </button>
        )}
        {!isOnline && onDeploy && status !== 'disabled' && (
          <button
            type="button"
            className={styles.invToggle}
            data-usage="action.deploy" title={`Deploy CODE on ${name}`}
            onClick={() => onDeploy(name)}
          >
            Deploy
          </button>
        )}
      </div>
      <div className={styles.bars}>
        <ResourceBar value={hp} max={maxHp} variant="hp" />
        <ResourceBar value={mp} max={maxMp} variant="mp" />
      </div>
      <div className={styles.summaryStats}>
        {member.level !== null && <span>Level {member.level}</span>}
        {member.map && <span>{member.map}</span>}
        {gold !== null && <span className={styles.gold}>{gold.toLocaleString()} gold</span>}
        {freeSlots !== null && <span>{freeSlots} free slots</span>}
        {hasInventoryData && <button type="button" className={styles.invToggle} aria-expanded={showInventory} onClick={() => setShowInventory(!showInventory)}>{showInventory ? 'Hide inventory' : 'Inventory'}</button>}
      </div>
      {member.intent?.state && <p className={styles.activity}>{member.intent.state}</p>}
      <details className={styles.technical}>
      <summary>Details & controls</summary>
      <p className={styles.details}>
        <span>{member.runtime}</span>
        {compatibleScripts.length > 0 && onChangeScript ? (
          <span className={styles.scriptBadge}>
            📜
            <select
              className={styles.scriptSelect}
              value={member.script || ''}
              onChange={e => onChangeScript(name, e.target.value)}
              title={`Assigned script for ${name} (Save & Deploy to apply)`}
            >
              {compatibleScripts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label || s.filename}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span>📜 {member.script}</span>
        )}
        {member.goldMultiplier !== null && <span className={styles.multiplier}>Gold ×{member.goldMultiplier.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>}
        {member.luckMultiplier !== null && <span className={styles.multiplier}>Luck ×{member.luckMultiplier.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>}
        {member.xpMultiplier !== null && <span className={styles.multiplier}>XP ×{member.xpMultiplier.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}</span>}
        {member.target && <span>Target: {member.target}</span>}
        {member.deploymentStage && <span>{member.deploymentStage}</span>}
      </p>
      <DecisionExplanation character={member.name} enabled={status !== 'disabled'} telemetry={telemetry} />
      </details>

      {showInventory && (
        <div className={styles.expandedDrawer}>
          <CharacterInventoryCard member={member} catalog={catalog} />
        </div>
      )}
    </li>
  );
}


