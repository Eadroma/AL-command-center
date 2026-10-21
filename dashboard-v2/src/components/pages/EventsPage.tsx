import { loadoutOptions } from '../../../shared/schema';
import type { FarmStyle, Profile } from '../../../shared/schema';
import type { Catalog, DeploymentsResponse } from '../../types';
import { dragoldBoard } from '../../models/dragold';
import {
  EVENT_DEFINITIONS,
  eventLabel,
  eventStyle,
  setAllEvents,
  setCharacterEvents,
  setEventAllowed,
  setEventsEnabled,
  setEventStyle,
} from '../../models/events';
import { Badge, Button, EmptyState, SelectInput, SectionHead, Sprite, Toggle } from '../ui';
import styles from './EventsPage.module.scss';
import { EventExpeditionPanel } from '../events/EventExpeditionPanel';

export interface EventsPageProps {
  profile?: Profile;
  catalog?: Catalog;
  version?: number;
  loading: boolean;
  dirty: boolean;
  conflict: boolean;
  pending: boolean;
  deploymentBusy: boolean;
  error?: string;
  notice?: string;
  onChange: (profile: Profile) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDeploy: () => void;
  deployments?: DeploymentsResponse;
}


/** Edit the global allowlist, per-character participation and combat style for live events. */
export function EventsPage({
  profile, catalog, version, loading, dirty, conflict, pending, deploymentBusy,
  error, notice, onChange, onSave, onDiscard, onDeploy, deployments,
}: EventsPageProps) {
  const disabled = !profile || pending;
  const canDeploy = !!profile && !pending && !dirty && !conflict && !deploymentBusy
    && profile.characters.some(character => character.enabled);
  const allowedCount = profile?.events.allowed.length ?? 0;
  const dragold = dragoldBoard(deployments);

  return (
    <section aria-label="Events and bosses configuration">
      <SectionHead eyebrow="When something appears" title="Events & bosses">
        <Badge variant={profile?.events.enabled ? 'success' : 'neutral'}>{profile?.events.enabled ? 'Enabled' : 'Paused'}</Badge>
        <Badge variant={allowedCount ? 'info' : 'neutral'}>{allowedCount}/{EVENT_DEFINITIONS.length} allowed</Badge>
      </SectionHead>
      <p className={styles.description}>Configure world events and follow the team’s current expedition.</p>
      {profile && <EventExpeditionPanel profile={profile} deployments={deployments} dirty={dirty} pending={pending || deploymentBusy} version={version} onChange={onChange} />}
      <section className={styles.dragoldIntel} aria-labelledby="dragold-intel-heading">
        <div className={styles.intelHead}>
          <div><span>Read-only multi-server intelligence</span><h3 id="dragold-intel-heading">Dragold scanner</h3></div>
          <Badge variant={dragold?.observations.some(row => row.live && !row.stale) ? 'success' : 'neutral'}>
            {dragold?.observations.filter(row => row.live && !row.stale).length ?? 0} live
          </Badge>
        </div>
        {!dragold ? <p>Deploy the warrior to start collecting server observations.</p> : <>
          <p>Scanner: {dragold.scanner} · current server {dragold.currentShard || 'unknown'} · observation only</p>
          <div className={styles.shards}>
            {dragold.observations.length === 0 ? <span>Waiting for server information…</span> : dragold.observations.map(row => (
              <article key={row.shard} className={row.live && !row.stale ? styles.liveShard : undefined}>
                <strong>{row.shard}</strong>
                <span>{row.stale ? 'STALE' : row.live ? 'LIVE' : row.spawnAt ? `SPAWN ${new Date(row.spawnAt).toLocaleString()}` : 'NOT LIVE'}</span>
                <small>seen {new Date(row.seenAt).toLocaleTimeString()}</small>
              </article>
            ))}
          </div>
        </>}
      </section>
      {loading && <EmptyState title="Loading event strategy…" />}
      {!loading && !profile && <EmptyState title="Profile unavailable" description="Use Refresh to retry the server connection." />}
      {!loading && profile && (
        <>
          <div className={styles.master}>
            <Toggle label="Enable live events" value={profile.events.enabled} disabled={pending} onChange={value => onChange(setEventsEnabled(profile, value))} />
            <span>Profile revision {version}{dirty ? ' · Unsaved changes' : ''}</span>
          </div>

          <section className={styles.participation} aria-labelledby="event-participation-heading">
            <h3 id="event-participation-heading">Character participation</h3>
            <div>{profile.characters.map(character => (
              <Toggle
                key={character.name}
                label={`${character.name} · ${character.ctype}`}
                value={profile.events.expedition.enabled ? ['warrior', 'priest'].includes(character.ctype) : character.events}
                disabled={pending || !character.enabled || profile.events.expedition.enabled}
                onChange={value => onChange(setCharacterEvents(profile, character.name, value))}
              />
            ))}</div>
          </section>

          {profile.events.expedition.enabled && <p className={styles.note}>This trial runs only the expedition events selected above. Other event rules are kept for normal farming mode.</p>}
          <div className={styles.bulk}>
            <Button size="small" variant="secondary" disabled={disabled || allowedCount === EVENT_DEFINITIONS.length} onClick={() => onChange(setAllEvents(profile, true))}>Allow all</Button>
            <Button size="small" variant="ghost" disabled={disabled || allowedCount === 0} onClick={() => onChange(setAllEvents(profile, false))}>Clear allowlist</Button>
          </div>

          <div className={styles.grid}>
            {EVENT_DEFINITIONS.map(event => {
              const allowed = profile.events.allowed.includes(event.id);
              const label = eventLabel(event, catalog);
              return (
                <article key={event.id} className={allowed ? styles.allowed : undefined}>
                  <Sprite id={event.monsterId || event.id} catalog={catalog} label={label} size={50} />
                  <div className={styles.identity}>
                    <h3>{label}</h3>
                    <span>{event.id} · {event.kind === 'event' ? 'Joinable event' : 'World boss'}</span>
                  </div>
                  <Toggle label={`Allow ${label}`} value={allowed} disabled={pending} onChange={value => onChange(setEventAllowed(profile, event.id, value))} />
                  <label className={styles.styleLabel} htmlFor={`event-style-${event.id}`}>Combat style</label>
                  <SelectInput
                    id={`event-style-${event.id}`}
                    value={eventStyle(profile, event)}
                    disabled={pending || !allowed}
                    onChange={value => onChange(setEventStyle(profile, event.id, value as FarmStyle))}
                    options={profile ? loadoutOptions(profile) : []}
                  />
                </article>
              );
            })}
          </div>

          {conflict && <p role="alert" className={styles.alert}>The profile changed in another window. Discard local edits before editing again.</p>}
          {error && <p role="alert" className={styles.alert}>{error}</p>}
          {notice && <p role="status" className={styles.notice}>{notice}</p>}
          <div className={styles.actions}>
            <Button variant="primary" data-usage="action.save" onClick={onSave} disabled={disabled || !dirty || conflict || deploymentBusy}>Save profile</Button>
            <Button variant="ghost" data-usage="action.discard" onClick={onDiscard} disabled={disabled || !dirty}>Discard edits</Button>
            <Button variant="primary" data-usage="action.deploy" onClick={onDeploy} disabled={!canDeploy}>{pending || deploymentBusy ? 'Operation in progress…' : 'Deploy saved profile'}</Button>
          </div>
          <p className={styles.note}>Rare camp visits and the Cave of Many Dreams remain controlled under Farming.</p>
        </>
      )}
    </section>
  );
}
