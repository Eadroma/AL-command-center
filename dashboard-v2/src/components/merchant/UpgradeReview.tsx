import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import type { CharacterTelemetry } from '../../types/deployments';
import type { UpgradeResolution } from '../../../shared/upgrade-history';
import { bankSnapshots } from '../../models/bank';
import { api } from '../../api/client';
import { Badge, Button, Field, SelectInput, Sprite, Toggle } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantPlanner.module.scss';
type Pending = NonNullable<CharacterTelemetry['upgradeProduction']>[number];
function quantities(value?: string) {
  if (!value) return 'Unavailable';
  try { const rows = Object.entries(JSON.parse(value) as Record<string, number>); return rows.length ? rows.map(([level, count]) => `+${level} ×${count}`).join(' · ') : 'No copies'; } catch { return 'Unavailable'; }
}
function ResolutionCard({ row, telemetry, deployments, catalog }: { row: Pending; telemetry: CharacterTelemetry; deployments?: DeploymentsResponse; catalog: Catalog }) {
  const [outcome, setOutcome] = useState(''), [verified, setVerified] = useState(false), [sending, setSending] = useState(false), [queued, setQueued] = useState(false), [message, setMessage] = useState('');
  const bank = bankSnapshots(deployments)[0];
  const bag = telemetry.inventory?.filter(item => item.name === row.item) ?? [];
  const bankItems = bank?.items.filter(item => item.name === row.item) ?? [];
  const action = row.action;
  const choices = action ? [{ value: '', label: 'Choose the verified outcome' }, { value: 'success', label: action.kind === 'purchase' ? 'Purchase received' : 'Upgrade succeeded' }, ...(action.kind === 'upgrade' ? [{ value: 'destroyed', label: 'Upgrade failed · piece destroyed' }] : []), { value: 'not_executed', label: 'Action never executed · release its cost' }] : [{ value: '', label: 'Choose the verified outcome' }, { value: 'keep_cost_resume', label: 'Resume with all costs and counters retained' }];
  async function resolve() {
    if (!verified || !outcome || !telemetry.live || queued || sending) return;
    setSending(true); setMessage('');
    try { await api('/api/merchant/upgrade/resolve', { item: row.item, runId: row.runId, actionId: action?.id ?? 'legacy', outcome: outcome as UpgradeResolution['outcome'], verified: true }); setQueued(true); setMessage('Resolution queued. Wait for fresh merchant telemetry to confirm application.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Resolution failed'); }
    finally { setSending(false); }
  }
  return <article className={styles.reviewCard}>
    <div className={styles.reviewHeading}><Sprite id={`item:${row.item}`} catalog={catalog} label={row.item} size={32} /><strong>{catalog.items.find(item => item.id === row.item)?.name ?? row.item}</strong><Badge variant="warning">Unconfirmed</Badge></div>
    <p>{action ? `${action.kind} · +${action.level} · ${new Date(action.at).toLocaleString()} · ${action.cost.toLocaleString()} material gold held` : 'Legacy reservation: no action identity or before-image was recorded. Resuming cannot infer a success.'}</p>
    {row.reviewReason && <p role={telemetry.live ? "alert" : "status"}><strong>Manual review needed:</strong> {row.reviewReason}</p>}
    <p>Before action, bag: {quantities(action?.before)}</p>
    <p>Current bag{telemetry.live ? '' : ' (stale)'}: {bag.length ? bag.map(item => `slot ${item.slot} · +${item.level} ×${item.quantity}`).join(' · ') : 'No copies reported'}</p>
    <p>Bank evidence: {bank?.capturedAt ? `${new Date(bank.capturedAt).toLocaleString()} · ${bank.owner}` : 'No timestamped snapshot'}. {bankItems.length ? bankItems.map(item => `${item.pack}:${item.slot} · +${item.level} ×${item.quantity}`).join(' · ') : 'No matching copies in this snapshot'}</p>
    <p>Copies can move or be identical. A snapshot does not prove which piece changed. Verify in game if the evidence is incomplete. Confirming success may increase finished output; “never executed” releases only this action's reserved cost.</p>
    <Field label="Verified outcome" htmlFor={`resolve-${row.item}`}><SelectInput id={`resolve-${row.item}`} value={outcome} onChange={value => { setOutcome(value); setVerified(false); }} options={choices} disabled={!telemetry.live || sending || queued} /></Field>
    <Toggle label="I checked inventory, bank and the action outcome" value={verified} disabled={!telemetry.live || sending || queued || !outcome} onChange={setVerified} />
    <Button size="small" disabled={!verified || !outcome || !telemetry.live || sending || queued} onClick={resolve}>{queued ? 'Awaiting runtime confirmation' : sending ? 'Queuing…' : 'Resolve and retain this run'}</Button>
    {message && <p role="status">{message}</p>}
  </article>;
}
export function UpgradeReview({ profile, catalog, deployments }: { profile: Profile; catalog: Catalog; deployments?: DeploymentsResponse }) {
  const merchant = profile.characters.find(c => c.enabled && c.ctype === 'merchant');
  const telemetry = merchant ? deployments?.characters[merchant.name]?.telemetry : undefined;
  const history = telemetry?.upgradeHistory;
  const [selected, setSelected] = useState('');
  const ids = [...new Set(history?.totals.map(row => row.item) ?? [])];
  const item = ids.includes(selected) ? selected : ids[0];
  const rows = history?.totals.filter(row => row.item === item) ?? [];
  const pending = telemetry?.upgradeProduction?.filter(row => row.pending) ?? [];
  return <>
    <CollapsiblePanel id="upgrade-resolution" title="Unconfirmed transaction review" eyebrow="Inspect · resolve · retain counters" defaultOpen={pending.length > 0} actions={<Badge variant={pending.length ? 'warning' : 'neutral'}>{pending.length} held</Badge>}>
      <p>The merchant checks held actions automatically. Exact inventory and material changes confirm success; definitive server rejections release the reserved cost. After one minute, unresolved actions raise an incident and stay held.</p>
      {!pending.length ? <p>No unconfirmed production action reported. Rebuild the merchant to record detailed action evidence.</p> : <div className={styles.grid}>{pending.map(row => <ResolutionCard key={`${row.item}:${row.runId}:${row.action?.id ?? 'legacy'}`} row={row} telemetry={telemetry!} deployments={deployments} catalog={catalog} />)}</div>}
    </CollapsiblePanel>
    <CollapsiblePanel id="upgrade-history" title="Upgrade history by item" eyebrow="Recorded outcomes · material costs">
      <p>{history ? `Recorded since ${new Date(history.startedAt).toLocaleString()}. ${telemetry?.live ? 'Reporter live' : 'Stored history · reporter stale'}. Last 60 actions; cumulative totals survive CODE restarts in the same browser.` : 'No history yet. Redeploy the merchant to start collecting; earlier logs are not reconstructed.'}</p>
      {item && <>
        <Field label="History item" htmlFor="upgrade-history-item"><SelectInput id="upgrade-history-item" value={item} onChange={setSelected} options={ids.map(id => ({ value: id, label: catalog.items.find(i => i.id === id)?.name ?? id }))} /></Field>
        <div className={styles.tableWrap}><table className={styles.historyTable}><thead><tr><th>Action</th><th>Attempts</th><th>Successes</th><th>Destroyed</th><th>Confirmed rate</th><th>Confirmed material cost</th><th>Held cost</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.kind}:${row.level}`}><td>{row.kind === 'upgrade' ? `+${row.level} → +${row.level + 1}` : 'Base purchase'}</td><td>{row.attempts}</td><td>{row.successes}</td><td>{row.destroyed}</td><td>{row.successes + row.destroyed ? `${(100 * row.successes / (row.successes + row.destroyed)).toFixed(1)}%` : '—'}</td><td>{Math.max(0, row.cost - row.pendingCost).toLocaleString()}</td><td>{row.pendingCost.toLocaleString()}</td></tr>)}</tbody></table></div>
        <p>Material value uses catalog prices; it is not wallet expenditure. Success rates exclude unresolved attempts and may be unreliable for small samples. Manually reviewed outcomes are included and identified below.</p>
        <details><summary>Recent actions for this item</summary><ol>{history?.entries.filter(entry => entry.item === item).slice().reverse().map(entry => <li key={entry.id}>{new Date(entry.at).toLocaleString()} · {entry.kind} +{entry.level} · {entry.outcome} · {entry.cost.toLocaleString()} gold{entry.automatic ? ' · automatically verified' : entry.manual ? ' · manually reviewed' : ''}</li>)}</ol></details>
      </>}
    </CollapsiblePanel>
  </>;
}
