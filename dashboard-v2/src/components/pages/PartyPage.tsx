import type { Catalog, LogEntry, PartyMember, Profile, DeploymentsResponse } from '../../types';
import type { ControlsPanelProps } from '../controls/ControlsPanel';
import type { TeamTool } from '../../models/navigation';
import { Users, Swords, Backpack, ChartNoAxesCombined, ArrowUpRight } from 'lucide-react';
import { PartyPanel } from '../party/PartyPanel';
import { PartyMap } from '../party/PartyMap';
import { OperationalSummary } from '../party/OperationalSummary';
import { Disclosure } from '../layout/Disclosure';
import styles from './PartyPage.module.scss';
export interface PartyPageProps {
  onOpenTool?: (tool: TeamTool) => void;
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

const tools = [
  { id: 'setup', label: 'Team setup', description: 'Characters, scripts and deployment', icon: Users },
  { id: 'farming', label: 'Farming & events', description: 'Targets, bosses and combat rules', icon: Swords },
  { id: 'inventory', label: 'Equipment & bags', description: 'Inspect items and loadouts', icon: Backpack },
  { id: 'insights', label: 'Activity & insights', description: 'XP, gold, history and diagnostics', icon: ChartNoAxesCombined },
] as const;
export function PartyPage({ members, catalog, loading, deployments, profile, onOpenTool,
  onDeployCharacter, onStopCharacter, onChangeScript }: PartyPageProps) {
  const enabled = profile?.characters.filter(c => c.enabled).length ?? 0;
  const live = members?.filter(c => c.status !== 'offline' && c.status !== 'disabled').length ?? 0;
  return <div className={styles.page} data-usage-scope="page.team">
    <header className={styles.heading}><div><span className={styles.eyebrow}>YOUR ADVENTURE, AT A GLANCE</span><h1>Team</h1><p>{enabled ? `${live} of ${enabled} enabled characters reporting. Everything else is one click away.` : 'Connect your account and prepare your first team.'}</p></div>
      <button type="button" className={styles.configure} onClick={() => onOpenTool?.('setup')}>{enabled ? 'Manage team' : 'Set up your team'}<ArrowUpRight size={17}/></button>
    </header>
    <PartyPanel members={members} deployments={deployments} catalog={catalog} loading={loading} onDeployCharacter={onDeployCharacter} onStopCharacter={onStopCharacter} onChangeScript={onChangeScript}/>
    <div className={styles.tools} aria-label="Team tools">{tools.map(tool => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={() => onOpenTool?.(tool.id)}><Icon size={23} aria-hidden="true"/><strong>{tool.label}</strong><span>{tool.description}</span><ArrowUpRight className={styles.arrow} size={17} aria-hidden="true"/></button>; })}</div>
    <Disclosure title="Live positions" description="Open the map to follow your team."><PartyMap members={members} catalog={catalog} loading={loading} deployments={deployments}/></Disclosure>
    <Disclosure title="Needs attention" description="Inspect warnings and operational signals."><OperationalSummary profile={profile} deployments={deployments}/></Disclosure>
  </div>;
}
