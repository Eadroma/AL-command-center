import { useState } from 'react';
import type { Catalog, DeploymentsResponse, Profile } from '../../types';
import { bankSnapshots, bankSortPreview, filterBankItems, groupBankItems } from '../../models/bank';
import { setBankDepositEnabled, setBankDepositItems } from '../../models/merchant';
import { api } from '../../api/client';
import { Badge, Button, EmptyState, Field, ItemMultiSelect, SectionHead, SelectInput, TextInput, Toggle } from '../ui';
import { BankItemCard } from '../bank/BankItemCard';
import { BankHubSummary } from '../bank/BankHubSummary';
import { MerchantDepositInventory } from '../bank/MerchantDepositInventory';
import styles from './BankPage.module.scss';

export interface BankPageProps {
  profile?: Profile;
  catalog?: Catalog;
  deployments?: DeploymentsResponse;
  loading: boolean;
  merchantName?: string;
  dirty: boolean;
  conflict: boolean;
  pending: boolean;
  deploymentBusy: boolean;
  onChange: (profile: Profile) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDeploy: () => void;
}

/** Browse the latest persisted bank snapshot reported by each deployed character. */
export function BankPage({ profile, catalog, deployments, loading, merchantName, dirty, conflict, pending, deploymentBusy, onChange, onSave, onDiscard, onDeploy }: BankPageProps) {
  const [owner, setOwner] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortPending, setSortPending] = useState(false);
  const [sortMessage, setSortMessage] = useState('');
  const [sortError, setSortError] = useState('');
  const snapshots = bankSnapshots(deployments);
  const selected = snapshots.find(snapshot => snapshot.owner === owner) ?? snapshots[0];
  const items = selected?.items ?? [];
  const categories = [...new Set(items.map(item => item.category || 'Other'))].sort();
  const visible = catalog ? filterBankItems(items, catalog, { search, category }) : [];
  const groups = groupBankItems(visible);
  const quantity = items.reduce((total, item) => total + item.quantity, 0);
  const reset = () => { setSearch(''); setCategory(''); };
  const preview = bankSortPreview(items);
  const merchantTelemetry = merchantName ? deployments?.characters[merchantName]?.telemetry : undefined;
  const sortStatus = merchantTelemetry?.bankSort;
  const sortBusy = sortPending || sortStatus?.state === 'queued' || sortStatus?.state === 'running';
  const requestSort = async () => {
    if (!merchantName || sortBusy) return;
    setSortPending(true); setSortMessage(''); setSortError('');
    try {
      await api('/api/bank/sort', { character: merchantName });
      setSortMessage('Sort command queued. The merchant will travel to the bank and report progress.');
    } catch (error) {
      setSortError(error instanceof Error ? error.message : 'Unable to queue the bank sort.');
    } finally {
      setSortPending(false);
    }
  };

  return (
    <section aria-label="Bank viewer">
      <SectionHead eyebrow="Latest persisted snapshot" title="Bank">
        {selected && <Badge variant={selected.live ? 'success' : 'neutral'}>{selected.live ? 'Reporter live' : 'Stored snapshot'}</Badge>}
        {selected && <Badge>{items.length} slots · {quantity.toLocaleString()} items</Badge>}
      </SectionHead>
      <p className={styles.description}>A snapshot refreshes when a rebuilt character can read its bank. It remains available after that character leaves the bank.</p>
      <BankHubSummary hub={merchantTelemetry?.bankHub} live={!!merchantTelemetry?.live} />
      <MerchantDepositInventory name={merchantName} telemetry={merchantTelemetry??undefined} catalog={catalog} busy={sortBusy||deploymentBusy}/>
      {profile && catalog && <section className={styles.deposit} aria-labelledby="bank-deposit-heading">
        <div className={styles.depositHead}>
          <div><span>Strict allowlist</span><h3 id="bank-deposit-heading">Recurring deposits</h3></div>
          <Toggle label="Enable recurring deposits" value={profile.seller.bankDeposit.enabled} disabled={pending} onChange={value => onChange(setBankDepositEnabled(profile, value))} />
        </div>
        <p>Only items selected below may be deposited automatically. An empty list deposits nothing.</p>
        <Field label="Items allowed into the bank" htmlFor="bank-deposit-items">
          <ItemMultiSelect id="bank-deposit-items" catalog={catalog} values={profile.seller.bankDeposit.items} disabled={pending} onChange={items => onChange(setBankDepositItems(profile, items))} />
        </Field>
        <div className={styles.depositActions}>
          <Badge variant={profile.seller.bankDeposit.items.length ? 'info' : 'neutral'}>{profile.seller.bankDeposit.items.length} allowed</Badge>
          <Button size="small" onClick={onSave} disabled={pending || !dirty || conflict || deploymentBusy}>Save profile</Button>
          <Button size="small" variant="ghost" onClick={onDiscard} disabled={pending || !dirty}>Discard</Button>
          <Button size="small" variant="secondary" onClick={onDeploy} disabled={pending || dirty || conflict || deploymentBusy}>Deploy saved profile</Button>
        </div>
      </section>}
      <section className={styles.sorter} aria-labelledby="bank-sorter-heading">
        <div>
          <span>Merchant maintenance</span>
          <h3 id="bank-sorter-heading">Global bank sorter</h3>
          <p>{preview.occupied} occupied slots across {preview.packs} packs · category → item name → highest level first.</p>
          <small>The merchant needs one empty inventory slot. Compatible partial stacks are merged before each floor is sorted.</small>
        </div>
        <div className={styles.sortActions}>
          {sortStatus && <Badge variant={sortStatus.state === 'failed' ? 'danger' : sortStatus.state === 'complete' ? 'success' : sortBusy ? 'info' : 'neutral'}>{sortStatus.phase} · {sortStatus.moved} moved · {sortStatus.merged} merged</Badge>}
          <Button variant="secondary" disabled={!merchantName || !merchantTelemetry?.live || sortBusy} onClick={requestSort}>
            {sortBusy ? 'Bank sort in progress…' : 'Sort bank with merchant'}
          </Button>
        </div>
      </section>
      {sortStatus?.message && <p className={sortStatus.state === 'failed' ? styles.sortError : styles.sortNotice}>{sortStatus.message}</p>}
      {sortMessage && <p className={styles.sortNotice}>{sortMessage}</p>}
      {sortError && <p className={styles.sortError} role="alert">{sortError}</p>}
      {loading && <EmptyState title="Loading bank snapshots…" />}
      {!loading && !catalog && <EmptyState title="Catalog unavailable" description="Use Refresh to retry the server connection." />}
      {!loading && catalog && snapshots.length === 0 && (
        <EmptyState title="No bank snapshot yet" description="Open the bank on a rebuilt character. The next telemetry pulse will preserve the snapshot." />
      )}
      {!loading && catalog && selected && (
        <>
          <div className={styles.tools}>
            <Field label="Snapshot owner" htmlFor="bank-owner">
              <SelectInput id="bank-owner" value={selected.owner} onChange={value => { setOwner(value); reset(); }} options={snapshots.map(snapshot => ({ value: snapshot.owner, label: snapshot.owner }))} />
            </Field>
            <Field label="Search bank" htmlFor="bank-search">
              <TextInput id="bank-search" type="search" value={search} onChange={setSearch} placeholder="Item, display name or pack…" />
            </Field>
            <Field label="Category" htmlFor="bank-category">
              <SelectInput id="bank-category" value={category} onChange={setCategory} options={[{ value: '', label: 'All categories' }, ...categories.map(value => ({ value, label: value }))]} />
            </Field>
            <Button variant="ghost" onClick={reset} disabled={!search && !category}>Reset filters</Button>
          </div>
          {selected.capturedAt && <p className={styles.capture}>Captured from {selected.owner} at {new Date(selected.capturedAt).toLocaleString()}.</p>}
          {items.length === 0 ? <EmptyState title="This snapshot contains no occupied slots" />
            : visible.length === 0 ? <EmptyState title="No matching bank items" description="Change or reset the filters." />
              : <div className={styles.groups}>{groups.map(group => (
                  <section key={group.category} className={styles.group} aria-label={`${group.category} bank items`}>
                    <h3>{group.category} <span>{group.items.length}</span></h3>
                    <div className={styles.grid}>{group.items.map(item => <BankItemCard key={`${item.pack}:${item.slot}`} item={item} catalog={catalog} />)}</div>
                  </section>
                ))}</div>}
        </>
      )}
    </section>
  );
}
