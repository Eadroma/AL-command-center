import type { Catalog, LogEntry, PartyMember, Profile, DeploymentsResponse } from '../../types';
import { ControlsPanel, type ControlsPanelProps } from '../controls/ControlsPanel';
import styles from './PartyPage.module.scss';
import { PartyPanel } from '../party/PartyPanel';
import { PartyMap } from '../party/PartyMap';
import { RuntimeInspector } from '../party/RuntimeInspector';
import { TelemetryPanel } from '../telemetry/TelemetryPanel';

import { DeploymentPreview } from '../party/DeploymentPreview';
import { TeamComposition } from '../party/TeamComposition';
import { OperationalSummary } from '../party/OperationalSummary';
import { DepartureChecklist } from '../farming/DepartureChecklist';
import { useState } from 'react';
import { Button } from '../ui';
import { PartyStats } from '../party/PartyStats';
import { FirstRunWizard } from '../onboarding/FirstRunWizard';

export interface PartyPageProps {
  profile?: Profile;
  deployments?: DeploymentsResponse;
  onChangeProfile: (profile: Profile) => void;
  members: PartyMember[] | null;
  catalog?: Catalog;
  loading: boolean;
  logs: LogEntry[];
  onClearLogs: () => void;
  controls: ControlsPanelProps;
  onDeployCharacter?: (name: string) => void;
  onStopCharacter?: (name: string) => void;
  onChangeScript?: (characterName: string, scriptId: string) => void;
}

/** Operational overview combining roster health, safe profile controls and recent telemetry. */
export function PartyPage({
  members, catalog, loading, logs, onClearLogs, controls, profile, deployments, onChangeProfile,
  onDeployCharacter, onStopCharacter, onChangeScript,
}: PartyPageProps) {
  const [view, setView] = useState<'overview'|'stats'>('overview');
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>Party overview</h1>
        <p>Monitor your characters, prepare changes, then inspect their live activity.</p>
      </header>
      <nav aria-label="Party views" style={{display:'flex',gap:'.5rem'}}><Button variant={view==='overview'?'secondary':'ghost'} aria-pressed={view==='overview'} onClick={()=>setView('overview')}>Overview</Button><Button variant={view==='stats'?'secondary':'ghost'} aria-pressed={view==='stats'} onClick={()=>setView('stats')}>Stats</Button></nav>
      {view==='stats'?<PartyStats profile={profile} deployments={deployments} catalog={catalog}/>:<>
      <section className={styles.live} aria-label="Live team overview">
        <OperationalSummary profile={profile} deployments={deployments} />
        <PartyPanel
        members={members}
        deployments={deployments}
        catalog={catalog}
        loading={loading}
        onDeployCharacter={onDeployCharacter}
        onStopCharacter={onStopCharacter}
        onChangeScript={onChangeScript}
      />
      </section>
      <section aria-labelledby="party-setup-heading">
        {profile && catalog && <FirstRunWizard profile={profile} catalog={catalog} dirty={controls.dirty} pending={controls.pending || controls.deploymentBusy} onChange={onChangeProfile} />}
        {profile ? <details className={styles.diagnostics}><summary>Before departure · preparation checklist</summary><DepartureChecklist profile={profile} deployments={deployments} /></details> : null}
        <div className={styles.sectionHeading}>
          <h2 id="party-setup-heading">Prepare & deploy</h2>
          <p>Choose the team, save your changes, and preview the saved deployment.</p>
        </div>
        <div className={styles.setup}>
          <TeamComposition profile={profile} disabled={controls.pending || controls.conflict || controls.deploymentBusy} onChange={onChangeProfile} />
          <ControlsPanel {...controls} />
          <DeploymentPreview version={controls.version} disabled={controls.dirty || controls.conflict || controls.pending || controls.deploymentBusy} onDeploy={onDeployCharacter} />
        </div>
      </section>
      <section aria-labelledby="party-map-heading">
        <div className={styles.sectionHeading}>
          <h2 id="party-map-heading">Live positions</h2>
          <p>Follow the team across maps and review recent movement.</p>
        </div>
        <PartyMap members={members} catalog={catalog} loading={loading} deployments={deployments} />
      </section>
      <details className={styles.diagnostics}>
        <summary>Runtime diagnostics & activity log</summary>
        <div className={styles.diagnosticContent}>
          <RuntimeInspector members={members} />
          <TelemetryPanel entries={logs} onClear={onClearLogs} />
        </div>
      </details>
      </>}
    </div>
  );
}
