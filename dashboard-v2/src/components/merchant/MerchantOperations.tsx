import { openDecisionEvidence } from '../../models/decision-navigation';
import { useState } from 'react';
import { EventExpeditionStatus } from '../events/EventExpeditionPanel';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { bankSnapshots } from '../../models/bank';
import { merchantCircuit } from '../../models/merchant-circuit';
import { inspectMerchantItem } from '../../models/merchant-inspection';
import { openMerchantRule } from '../../models/rule-navigation';
import { Badge, Button, Card, Field, ItemMultiSelect, NumberInput, Sprite } from '../ui';
import styles from './MerchantPlanner.module.scss';
import operationStyles from './MerchantOperations.module.scss';

const destinations: Record<string, string> = { bank: 'bank', sell: 'merchant-npc', exchange: 'merchant-ex', upgrade: 'merchant-up', purchase: 'merchant-up', stand: 'merchant-stand', compound: 'merchant-compound' };
export function MerchantOperations({ profile, catalog, deployments, dirty }: { profile: Profile; catalog: Catalog; deployments?: DeploymentsResponse; dirty: boolean }) {
  const merchant = profile.characters.find(row => row.enabled && row.ctype === 'merchant');
  const telemetry = merchant ? deployments?.characters[merchant.name]?.telemetry : undefined;
  const inventory = telemetry?.live ? telemetry.inventory ?? [] : [];
  const circuit = merchantCircuit(profile, telemetry ?? undefined);
  const bank = bankSnapshots(deployments).find(row => row.owner === merchant?.name);
  const [item, setItem] = useState('');
  const [level, setLevel] = useState<number | null>(0);
  const selected = item || catalog.items[0]?.id || '';
  const actual = inventory.find(row => row.name === selected && row.level === (level ?? 0));
  const decisions = inspectMerchantItem(profile, catalog, actual ?? { name: selected, level: level ?? 0, locked: false, bound: false }, inventory);
  const bankSource = inventory.flatMap(stock => inspectMerchantItem(profile, catalog, stock, inventory)).find(decision => decision.action === 'Deposit')?.panel ?? 'bank';
  const blockerPanel = telemetry?.upgradeProduction?.some(row => row.pending) ? 'merchant-up' : /compound/i.test(circuit?.blockedBy ?? '') ? 'merchant-compound' : /bank/i.test(circuit?.blockedBy ?? '') ? 'bank' : /exchange|xyn/i.test(circuit?.blockedBy ?? '') ? 'merchant-ex' : /budget|quantity|production/i.test(circuit?.blockedBy ?? '') ? 'merchant-up' : 'merchant-planner';
  return <section aria-label="Merchant operations" className={operationStyles.operations}>

    <Card title="Merchant at a glance" headerActions={merchant && <Button size="small" variant="ghost" onClick={() => openDecisionEvidence(merchant.name)}>Decision & evidence</Button>}>
      <div className={operationStyles.summaryGrid}>
        <article><strong>Activity</strong><span>{circuit?.action ?? 'Waiting for fresh telemetry'}</span><span>{telemetry?.standOpen ? 'Stand open' : 'Stand closed / unavailable'}</span><span>{telemetry?.live ? `${Math.max(0, 42 - inventory.length)} / 42 bag slots free` : 'Bag space unavailable'}</span></article>
        <article><strong>Progress</strong><span>Next candidate: {circuit?.next ?? 'Queue unavailable'}</span><span>{circuit?.transaction ? `${circuit.transaction.kind} · ${circuit.transaction.state}` : 'No transaction reported'}</span>{telemetry?.live && telemetry.upgradeProduction?.filter(row => row.pending || (!profile.seller.upgrade.rules.find(rule => rule.item === row.item)?.paused && (row.unbounded || row.produced < row.quantity))).map(row => <span key={row.item}>{row.item}: {row.unbounded ? 'unbounded run' : `${row.produced}/${row.quantity} finished`} · {row.spent.toLocaleString()}{row.unbounded ? '' : `/${row.budget.toLocaleString()}`} gold{row.pending ? ' · awaiting confirmation' : ''}</span>)}</article>
        <article><strong>Blockers</strong><span>{circuit?.blockedBy ?? (circuit ? 'None reported' : 'Offline or stale telemetry')}</span>{circuit?.blockedBy && <Button size="small" variant="ghost" onClick={() => openMerchantRule(blockerPanel)}>Inspect related rules</Button>}</article>
      </div>
      <details className={operationStyles.details}><summary>Queue details and preview assumptions</summary><p>{dirty ? 'Preview uses unsaved editor settings.' : 'Preview uses saved settings.'} Candidate actions remain subject to runtime checks.</p>
      {circuit && <ol className={operationStyles.queue}>{circuit.stops.filter(stop => (stop.candidates ?? 0) > 0).map(stop => <li key={stop.id}><Button size="small" variant="ghost" onClick={() => openMerchantRule(stop.id === 'bank' ? bankSource : destinations[stop.id])}>{stop.label} · {stop.candidates} candidates</Button><span>{stop.detail}</span></li>)}</ol>}
    </details>
    </Card>
    <details className={operationStyles.details}><summary>Event mission and temporary workers</summary><EventExpeditionStatus profile={profile} deployments={deployments} /></details>
    <details className={operationStyles.details}><summary>Compound progression</summary>
    <Card title="Compound progression">
      <p>Inventory is live. Bank: {bank?.capturedAt ? new Date(bank.capturedAt).toLocaleString() : 'not observed'}. Bank counts are a snapshot; protected bank copies may not be usable.</p>
      <div className={styles.grid}>{profile.seller.compound.rules.map(rule => <article key={rule.item}>
        <div><Sprite id={`item:${rule.item}`} catalog={catalog} label={rule.item} size={32} /><strong>{catalog.items.find(row => row.id === rule.item)?.name ?? rule.item}</strong><Badge variant={profile.seller.compound.enabled ? 'info' : 'neutral'}>Target +{rule.maxLevel}</Badge></div>
        {Array.from({ length: rule.maxLevel + 1 }, (_, level) => {
          const carried = inventory.filter(row => row.name === rule.item && row.level === level && !row.locked && !row.bound).reduce((n, row) => n + row.quantity, 0);
          const stored = bank?.items.filter(row => row.name === rule.item && row.level === level).reduce((n, row) => n + row.quantity, 0);
          return <span key={level}>+{level}: bag {telemetry?.live ? carried : '—'} · bank {stored ?? '—'}{level < rule.maxLevel ? ` · ${telemetry?.live ? Math.floor(carried / 3) : '—'} bag trios${stored !== undefined ? ` / ${Math.floor((carried + stored) / 3)} potential total` : ''}` : ' · finished'}</span>;
        })}
        {telemetry?.compoundProgress?.find(row => row.item === rule.item) ? (() => {
          const row = telemetry.compoundProgress!.find(row => row.item === rule.item)!;
          return <><span>{row.attempts} attempts · {row.successes} successes · {row.destroyed} destructions · {row.unconfirmed} unconfirmed</span><small>{row.scrollGold.toLocaleString()} gold in acknowledged scroll replacement value · since tracking began</small></>;
        })() : <small>{telemetry?.compoundProgress !== undefined ? 'No attempts recorded yet.' : 'Attempt tracking starts with the next merchant deployment.'}</small>}
        <Button size="small" variant="ghost" onClick={() => openMerchantRule('merchant-compound')}>Open target</Button>
      </article>)}</div>
      {!profile.seller.compound.rules.length && <p>No compound targets configured.</p>}
    </Card>
    </details>
    <details className={styles.circuit}><summary>Preview an item’s rules</summary>
      <div className={styles.grid}>
        <Field label="Item" htmlFor="inspect-merchant-item"><ItemMultiSelect id="inspect-merchant-item" catalog={catalog} values={[selected]} onChange={values => setItem(values.find(value => value !== selected) ?? values[0] ?? '')} /></Field>
        <Field label="Level +" htmlFor="inspect-merchant-level"><NumberInput id="inspect-merchant-level" min={0} max={15} value={level} onChange={setLevel} /></Field>
      </div>
      <p>Uses editor settings and available inventory; does not execute actions. Other ownership, kit, gift, commercial-goal and server protections may apply.</p>
      {decisions.map((decision, index) => <p key={`${decision.panel}:${index}`}><Button size="small" variant="ghost" onClick={() => openMerchantRule(decision.panel)}>{decision.action}</Button> {decision.reason}</p>)}
    </details>
  </section>;
}
