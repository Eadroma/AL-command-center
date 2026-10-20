/**
 * @file PartyPanel.tsx
 * Full party roster panel.
 *
 * Renders the list of party members inside a Card, handles empty/loading
 * states, and wires each member to a PartyMemberRow. This component is
 * purely presentational — data is passed in via props from a parent that
 * owns the WebSocket / polling logic.
 */

import { Users } from 'lucide-react';
import { Card, Badge } from '../ui';
import { PartyMemberRow } from './PartyMemberRow';
import type { Catalog, DeploymentsResponse } from '../../types';
import type { PartyMember } from '../../types/party';
import styles from './PartyPanel.module.scss';

// ---------------------------------------------------------------------------
// Props & Component
// ---------------------------------------------------------------------------

export interface PartyPanelProps {
  deployments?: DeploymentsResponse;
  /**
   * Live party roster from the Command Center API.
   * Pass `null` while the first fetch is still in flight.
   */
  members: PartyMember[] | null;
  /** True while data is being (re-)fetched. Shows a subtle loading indicator. */
  loading?: boolean;
  /** Checked-in sprite catalog used for member portraits. */
  catalog?: Catalog;
  /** Callback to deploy a single character's CODE. */
  onDeployCharacter?: (name: string) => void;
  /** Callback to stop a single character's CODE. */
  onStopCharacter?: (name: string) => void;
  /** Callback when user changes a character's script. */
  onChangeScript?: (characterName: string, scriptId: string) => void;
}

/**
 * PartyPanel
 *
 * Displays the full party roster as a stacked list of PartyMemberRow items.
 * Handles three states:
 *   - `null` members → skeleton/loading state
 *   - Empty array    → "No members online" notice
 *   - Populated      → one row per member
 *
 * The online count badge in the header reflects how many members are not 'offline' or 'dead'.
 */
export function PartyPanel({ members, deployments, loading = false, catalog, onDeployCharacter, onStopCharacter, onChangeScript }: PartyPanelProps) {
  const enabledMembers = members?.filter(member => member.status !== 'disabled') ?? [];
  const onlineCount = members
    ? enabledMembers.filter(m => m.status !== 'offline' && m.status !== 'dead').length
    : 0;

  return (
    <Card
      title="Party Status"
      headerActions={
        members !== null && (
          <Badge variant={onlineCount > 0 ? 'success' : 'neutral'}>
            {onlineCount}/{enabledMembers.length} online
          </Badge>
        )
      }
    >
      {loading && <p className={styles.hint}>Syncing…</p>}

      {members === null && !loading && (
        <div className={styles.empty}>
          <Users size={24} className={styles.emptyIcon} />
          <span>Waiting for connection</span>
        </div>
      )}

      {members !== null && members.length === 0 && (
        <p className={styles.hint}>No members online.</p>
      )}

      {members !== null && members.length > 0 && (
        <ul className={styles.list}>
          {members.map(member => (
            <PartyMemberRow
              key={member.name}
              member={member}
              telemetry={deployments?.characters[member.name]?.telemetry ?? undefined}
              catalog={catalog}
              onDeploy={onDeployCharacter}
              onStop={onStopCharacter}
              onChangeScript={onChangeScript}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
