import { lazy, Suspense } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PageHeader } from './components/layout/PageHeader';
import { NavBar } from './components/layout/NavBar';
import { GlobalSearch } from './components/layout/GlobalSearch';
import { TaskDialog } from './components/layout/TaskDialog';
import { Disclosure } from './components/layout/Disclosure';
import { PartyPage } from './components/pages/PartyPage';
const BankPage = lazy(() => import('./components/pages/BankPage').then(m => ({ default: m.BankPage })));
const MerchantPage = lazy(() => import('./components/pages/MerchantPage').then(m => ({ default: m.MerchantPage })));
const InventoryPage = lazy(() => import('./components/pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const FarmingPage = lazy(() => import('./components/pages/FarmingPage').then(m => ({ default: m.FarmingPage })));
const EventsPage = lazy(() => import('./components/pages/EventsPage').then(m => ({ default: m.EventsPage })));
const ActivityPage = lazy(() => import('./components/pages/ActivityPage').then(m => ({ default: m.ActivityPage })));
const ScriptsPage = lazy(() => import('./components/pages/ScriptsPage').then(m => ({ default: m.ScriptsPage })));
const CombatPage = lazy(() => import('./components/pages/CombatPage').then(m => ({ default: m.CombatPage })));
const LootSimulatorPage = lazy(() => import('./components/pages/LootSimulatorPage').then(m => ({ default: m.LootSimulatorPage })));
import { ControlsPanel } from './components/controls/ControlsPanel';
import { TeamComposition } from './components/party/TeamComposition';
import { DeploymentPreview } from './components/party/DeploymentPreview';
import { PartyStats } from './components/party/PartyStats';
import { FirstRunWizard } from './components/onboarding/FirstRunWizard';
import { DepartureChecklist } from './components/farming/DepartureChecklist';
import { DecisionEvidenceDrawer } from './components/party/DecisionEvidenceDrawer';
import { ItemDetailsDrawer } from './components/inventory/ItemDetailsDrawer';
import { ConfigurationImpact } from './components/party/ConfigurationImpact';
import { EmptyState } from './components/ui';
import { usePartyState } from './hooks/usePartyState';
import { useProfile } from './hooks/useProfile';
import { useRoute } from './hooks/usePage';
import { teamToolHash, type TeamTool } from './models/navigation';
const IncidentsPage = lazy(() => import('./components/pages/IncidentsPage').then(m => ({ default: m.IncidentsPage })));
const CavePage = lazy(() => import('./components/pages/CavePage').then(m => ({ default: m.CavePage })));
const PerformancePage = lazy(() => import('./components/pages/PerformancePage').then(m => ({ default: m.PerformancePage })));
const DeploymentsPage = lazy(() => import('./components/pages/DeploymentsPage').then(m => ({ default: m.DeploymentsPage })));
const OperationsPage = lazy(() => import('./components/pages/OperationsPage').then(m => ({ default: m.OperationsPage })));
const titles: Record<TeamTool,string> = { setup: 'Team setup', farming: 'Farming & events', inventory: 'Equipment & bags', insights: 'Activity & insights' };
export function App() {
  const party = usePartyState(), profile = useProfile(party.snapshot), route = useRoute();
  const saved = party.snapshot?.profile;
  const busy = profile.pending || party.deploymentBusy;
  const common = { profile: profile.profile, catalog: party.snapshot?.catalog, deployments: party.deployments,
    version: profile.version, loading: party.loading, dirty: profile.dirty, conflict: profile.conflict, pending: profile.pending,
    deploymentBusy: party.deploymentBusy, error: profile.error, notice: profile.notice, members: party.partyMembers,
    onChange: profile.replace, onSave: profile.save, onDiscard: profile.discard, onDeploy: profile.deploy };
  const tools = route.page === 'team' ? route.tool : undefined;
  const reveal = (section: string) => route.section === section;
  return <AppShell header={<PageHeader connected={party.connected} onRefresh={party.refreshAll} nav={<NavBar page={route.page} dirty={profile.dirty}/>} search={<GlobalSearch profile={profile.profile} catalog={party.snapshot?.catalog}/>} />}>
    <DecisionEvidenceDrawer profile={saved} deployments={party.deployments}/>
    <ItemDetailsDrawer profile={saved} catalog={party.snapshot?.catalog} deployments={party.deployments} members={party.partyMembers}/>
    {profile.dirty && <Disclosure title="Review pending changes" description="Changes apply only after saving and deploying."><ConfigurationImpact saved={profile.baseProfile} draft={profile.profile} deployments={party.deployments} catalog={party.snapshot?.catalog} conflict={profile.conflict}/></Disclosure>}
    {party.error && <p role="alert">Unable to synchronize: {party.error}. Use Refresh to retry.</p>}
    {route.page === 'team' && <PartyPage profile={profile.profile} deployments={party.deployments} onChangeProfile={profile.replace} members={party.partyMembers} catalog={party.snapshot?.catalog} loading={party.loading} logs={party.logs} onClearLogs={party.clearLogs} onDeployCharacter={profile.deployCharacter} onStopCharacter={profile.stopCharacter} onChangeScript={profile.changeScript}
      onOpenTool={tool => { window.location.hash = teamToolHash(tool); }}
      controls={{...profile, deploymentBusy: party.deploymentBusy, onChange: profile.change, onSave: profile.save, onDiscard: profile.discard, onDeploy: profile.deploy, onStopParty: profile.stopParty}}/>}
    <Suspense fallback={<EmptyState title="Loading workspace…"/>}>
    {route.page === 'merchant' && <MerchantPage {...common}/>}
    {route.page === 'bank' && <BankPage {...common} merchantName={saved?.characters.find(c => c.enabled && c.ctype === 'merchant')?.name}/>}
    </Suspense>
    <TaskDialog title={tools ? titles[tools] : 'Team tools'} open={!!tools} onClose={() => { window.location.hash = 'team'; }}>
      <Suspense fallback={<EmptyState title="Loading tool…"/>}>
        {tools === 'setup' && <>
          {profile.profile && party.snapshot?.catalog && <FirstRunWizard profile={profile.profile} catalog={party.snapshot.catalog} dirty={profile.dirty} pending={busy} onChange={profile.replace}/>}
          <TeamComposition profile={profile.profile} disabled={busy || profile.conflict} onChange={profile.replace}/>
          <ControlsPanel {...common} onChange={profile.change} onStopParty={profile.stopParty}/>
          <Disclosure title="Preview saved deployment" reveal={reveal('deployments')}><DeploymentPreview version={profile.version} disabled={profile.dirty || profile.conflict || busy} onDeploy={profile.deployCharacter}/><DeploymentsPage/></Disclosure>
          <Disclosure title="Preparation checklist">{profile.profile && <DepartureChecklist profile={profile.profile} deployments={party.deployments}/>}</Disclosure>
          <Disclosure title="Script catalogue" reveal={reveal('scripts')}><ScriptsPage catalog={party.snapshot?.catalog} characters={saved?.characters ?? []} loading={party.loading}/></Disclosure>
        </>}
        {tools === 'farming' && <>
          <Disclosure title="Farming targets & loadouts" description="Choose targets, hunts, equipment and safety rules." reveal={reveal('farming')}><FarmingPage {...common}/></Disclosure>
          <Disclosure title="Events & bosses" description="Select combat events and expedition participants." reveal={reveal('events')}><EventsPage {...common}/></Disclosure>
          <Disclosure title="Cave Dreams" description="Inspect the current run and cave controls." reveal={reveal('cave')}><CavePage profile={saved} deployments={party.deployments} loading={party.loading}/></Disclosure>
        </>}
        {tools === 'inventory' && <InventoryPage members={party.partyMembers} catalog={party.snapshot?.catalog} deployments={party.deployments} profile={saved} loading={party.loading}/>}
        {tools === 'insights' && <>
          <PartyStats profile={saved} deployments={party.deployments} catalog={party.snapshot?.catalog}/>
          <Disclosure title="Combat performance" reveal={reveal('combat')}><CombatPage profile={saved} deployments={party.deployments} catalog={party.snapshot?.catalog} loading={party.loading}/></Disclosure>
          <Disclosure title="Operations & movement" reveal={reveal('operations')}><OperationsPage profile={saved} deployments={party.deployments} loading={party.loading}/></Disclosure>
          <Disclosure title="Incidents" reveal={reveal('incidents')}><IncidentsPage profile={saved} deployments={party.deployments} loading={party.loading}/></Disclosure>
          <Disclosure title="Performance history" reveal={reveal('performance')}><PerformancePage profile={saved}/></Disclosure>
          <Disclosure title="Loot estimates" reveal={reveal('simulator')}><LootSimulatorPage profile={saved} catalog={party.snapshot?.catalog} deployments={party.deployments} loading={party.loading}/></Disclosure>
          <Disclosure title="Activity log" reveal={reveal('activity')}><ActivityPage entries={party.logs} loading={party.loading} onClear={party.clearLogs}/></Disclosure>
        </>}
      </Suspense>
    </TaskDialog>
  </AppShell>;
}
