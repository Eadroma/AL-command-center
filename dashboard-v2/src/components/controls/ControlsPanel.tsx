import { Card, Toggle, Button } from '../ui';
import type { Profile } from '../../../shared/schema';
import type { AutomationKey } from '../../models/profile';
import styles from './ControlsPanel.module.scss';

interface ControlDescriptor {
  id: AutomationKey;
  label: string;
  description: string;
}

const CONTROLS: readonly ControlDescriptor[] = [
  {
    id: 'hunts',
    label: 'Daisy Hunt System',
    description: 'Fetch and complete Monster Hunter contracts.',
  },
  {
    id: 'rareVisits',
    label: 'Rare Boss Visits',
    description: 'Allow rare boss rounds using the saved rules.',
  },
  {
    id: 'events',
    label: 'World Events',
    description: 'Participate in the events allowed by the saved profile.',
  },
];

export interface ControlsPanelProps {
  profile?: Profile;
  version?: number;
  dirty: boolean;
  conflict: boolean;
  pending: boolean;
  deploymentBusy: boolean;
  error?: string;
  notice?: string;
  onChange: (key: AutomationKey, value: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDeploy: () => void;
  onStopParty?: () => void;
}

/** Controlled profile editor. Saving and deploying are distinct user actions. */
export function ControlsPanel({
  profile, version, dirty, conflict, pending, deploymentBusy,
  error, notice, onChange, onSave, onDiscard, onDeploy, onStopParty,
}: ControlsPanelProps) {
  const disabled = !profile || pending;
  const canDeploy = !disabled && !dirty && !conflict && !deploymentBusy
    && profile.characters.some(character => character.enabled);

  return (
    <Card title="Automation Controls" variant="active">
      <p role="status">
        {profile ? `${profile.name} · revision ${version}${dirty ? ' · Unsaved changes' : ''}` : 'Waiting for profile…'}
      </p>
      <div className={styles.toggleList}>
        {CONTROLS.map(control => {
          const value = profile
            ? control.id === 'events' ? profile.events.enabled : profile.farming[control.id]
            : false;
          return (
            <div key={control.id} className={styles.toggleRow}>
              <Toggle
                label={control.label}
                value={value}
                disabled={disabled}
                onChange={next => onChange(control.id, next)}
              />
              <p className={styles.description}>{control.description}</p>
            </div>
          );
        })}
      </div>
      {conflict && (
        <p role="alert">
          The profile changed in another window. Discard local edits to load the latest revision before editing again.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className={styles.footer}>
        <Button variant="primary" data-usage="action.save" onClick={onSave} disabled={disabled || !dirty || conflict || deploymentBusy}>
          Save profile
        </Button>
        <Button variant="ghost" data-usage="action.discard" onClick={onDiscard} disabled={disabled || !dirty}>
          Discard edits
        </Button>
        <Button variant="primary" data-usage="action.deploy" onClick={onDeploy} disabled={!canDeploy}>
          {pending || deploymentBusy ? 'Operation in progress…' : 'Deploy saved profile'}
        </Button>
        {onStopParty && (
          <Button variant="ghost" data-usage="action.stop" onClick={onStopParty} disabled={disabled || deploymentBusy}>
            Stop Party CODE
          </Button>
        )}
      </div>
    </Card>
  );
}
