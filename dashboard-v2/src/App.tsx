import { DecisionEvidenceDrawer } from './components/party/DecisionEvidenceDrawer';
import { MissionBanner } from './components/party/MissionBanner';
import { ItemDetailsDrawer } from './components/inventory/ItemDetailsDrawer';
import { GlobalSearch } from './components/layout/GlobalSearch';
import { lazy, Suspense } from 'react';
import { AppShell } from './components/layout/AppShell';
import { PageHeader } from './components/layout/PageHeader';
import { NavBar } from './components/layout/NavBar';
import { ActivityPage } from './components/pages/ActivityPage';
import { ScriptsPage } from './components/pages/ScriptsPage';
import { BankPage } from './components/pages/BankPage';
import { CombatPage } from './components/pages/CombatPage';
import { LootSimulatorPage } from './components/pages/LootSimulatorPage';
import { PartyPage } from './components/pages/PartyPage';
import { InventoryPage } from './components/pages/InventoryPage';
import { EventsPage } from './components/pages/EventsPage';
import { FarmingPage } from './components/pages/FarmingPage';
import { MerchantPage } from './components/pages/MerchantPage';
import { EmptyState } from './components/ui';
import { usePartyState } from './hooks/usePartyState';
import { useProfile } from './hooks/useProfile';
import { usePage } from './hooks/usePage';
import { ConfigurationImpact } from './components/party/ConfigurationImpact';

const IncidentsPage = lazy(() => import('./components/pages/IncidentsPage').then(module => ({ default: module.IncidentsPage })));
const CavePage = lazy(() => import('./components/pages/CavePage').then(module => ({ default: module.CavePage })));
const PerformancePage = lazy(() => import('./components/pages/PerformancePage').then(module => ({ default: module.PerformancePage })));
const DeploymentsPage = lazy(() => import('./components/pages/DeploymentsPage').then(module => ({ default: module.DeploymentsPage })));
const OperationsPage = lazy(() => import('./components/pages/OperationsPage').then(module => ({ default: module.OperationsPage })));

/** Composition root: server state, revision-bound editing, and feature pages. */
export function App() {
  const party = usePartyState();
  const profile = useProfile(party.snapshot);
  const page = usePage();

  return (
    <AppShell header={<PageHeader connected={party.connected} onRefresh={party.refreshAll} search={<GlobalSearch profile={profile.profile} catalog={party.snapshot?.catalog} />} />}>
      <NavBar page={page} dirty={profile.dirty} />
      {['party','merchant'].includes(page)&&<MissionBanner profile={party.snapshot?.profile} deployments={party.deployments} />}
      <DecisionEvidenceDrawer profile={party.snapshot?.profile} deployments={party.deployments} />
      <ItemDetailsDrawer profile={party.snapshot?.profile} catalog={party.snapshot?.catalog} deployments={party.deployments} members={party.partyMembers} />
      {profile.dirty ? <ConfigurationImpact saved={profile.baseProfile} draft={profile.profile} deployments={party.deployments} catalog={party.snapshot?.catalog} conflict={profile.conflict} /> : null}
      {party.error && (
        <p role="alert">Unable to synchronize: {party.error}. Use Refresh to retry.</p>
      )}
      {page === 'party' && (
        <PartyPage
          profile={profile.profile}
          deployments={party.deployments}
          onChangeProfile={profile.replace}
          members={party.partyMembers}
          catalog={party.snapshot?.catalog}
          loading={party.loading}
          logs={party.logs}
          onClearLogs={party.clearLogs}
          onDeployCharacter={profile.deployCharacter}
          onStopCharacter={profile.stopCharacter}
          onChangeScript={profile.changeScript}
          controls={{
            ...profile,
            deploymentBusy: party.deploymentBusy,
            onChange: profile.change,
            onSave: profile.save,
            onDiscard: profile.discard,
            onDeploy: profile.deploy,
            onStopParty: profile.stopParty,
          }}
        />
      )}
      {page === 'inventory' && (
        <InventoryPage
          members={party.partyMembers}
          catalog={party.snapshot?.catalog}
          deployments={party.deployments}
          profile={party.snapshot?.profile}
          loading={party.loading}
        />
      )}
      {page === 'activity' && (
        <ActivityPage entries={party.logs} loading={party.loading} onClear={party.clearLogs} />
      )}
      {page === 'combat' && (
        <CombatPage profile={party.snapshot?.profile} deployments={party.deployments} catalog={party.snapshot?.catalog} loading={party.loading} />
      )}
      {page === 'operations' && (
        <Suspense fallback={<EmptyState title="Loading operations center…" />}><OperationsPage profile={party.snapshot?.profile} deployments={party.deployments} loading={party.loading} /></Suspense>
      )}
      {page === 'incidents' && (
        <Suspense fallback={<EmptyState title="Loading Incident Center…" />}><IncidentsPage deployments={party.deployments} profile={party.snapshot?.profile} loading={party.loading} /></Suspense>
      )}
      {page === 'cave' && (
        <Suspense fallback={<EmptyState title="Loading Cave Dreams…" />}><CavePage profile={party.snapshot?.profile} deployments={party.deployments} loading={party.loading} /></Suspense>
      )}
      {page === 'performance' && (
        <Suspense fallback={<EmptyState title="Loading performance history…" />}><PerformancePage profile={party.snapshot?.profile} /></Suspense>
      )}
      {page === 'deployments' && (
        <Suspense fallback={<EmptyState title="Loading deployment history…" />}><DeploymentsPage /></Suspense>
      )}
      {page === 'simulator' && (
        <LootSimulatorPage profile={party.snapshot?.profile} catalog={party.snapshot?.catalog} deployments={party.deployments} loading={party.loading} />
      )}
      {page === 'farming' && (
        <FarmingPage
          deployments={party.deployments}
          profile={profile.profile}
          catalog={party.snapshot?.catalog}
          version={profile.version}
          loading={party.loading}
          dirty={profile.dirty}
          conflict={profile.conflict}
          pending={profile.pending}
          deploymentBusy={party.deploymentBusy}
          error={profile.error}
          notice={profile.notice}
          members={party.partyMembers}
          onChange={profile.replace}
          onSave={profile.save}
          onDiscard={profile.discard}
          onDeploy={profile.deploy}
        />
      )}
      {page === 'bank' && (
        <BankPage
          profile={profile.profile}
          catalog={party.snapshot?.catalog}
          deployments={party.deployments}
          loading={party.loading}
          merchantName={party.snapshot?.profile.characters.find(character => character.enabled && character.ctype === 'merchant')?.name}
          dirty={profile.dirty}
          conflict={profile.conflict}
          pending={profile.pending}
          deploymentBusy={party.deploymentBusy}
          onChange={profile.replace}
          onSave={profile.save}
          onDiscard={profile.discard}
          onDeploy={profile.deploy}
        />
      )}
      {page === 'merchant' && (
        <MerchantPage
          deployments={party.deployments}
          profile={profile.profile}
          catalog={party.snapshot?.catalog}
          version={profile.version}
          loading={party.loading}
          dirty={profile.dirty}
          conflict={profile.conflict}
          pending={profile.pending}
          deploymentBusy={party.deploymentBusy}
          error={profile.error}
          notice={profile.notice}
          members={party.partyMembers}
          onChange={profile.replace}
          onSave={profile.save}
          onDiscard={profile.discard}
          onDeploy={profile.deploy}
        />
      )}
      {page === 'events' && (
        <EventsPage
          profile={profile.profile}
          catalog={party.snapshot?.catalog}
          version={profile.version}
          loading={party.loading}
          dirty={profile.dirty}
          conflict={profile.conflict}
          pending={profile.pending}
          deploymentBusy={party.deploymentBusy}
          error={profile.error}
          notice={profile.notice}
          deployments={party.deployments}
          onChange={profile.replace}
          onSave={profile.save}
          onDiscard={profile.discard}
          onDeploy={profile.deploy}
        />
      )}
      {page === 'scripts' && (
        <ScriptsPage
          catalog={party.snapshot?.catalog}
          characters={party.snapshot?.profile.characters ?? []}
          loading={party.loading}
        />
      )}
    </AppShell>
  );
}
