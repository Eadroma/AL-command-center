import { EquipmentProtectionInspector } from '../inventory/EquipmentProtectionInspector';
import { useEffect, useState } from 'react';
import type { Catalog, DeploymentsResponse, PartyMember, Profile } from '../../types';
import { computePartyWealth } from '../../models/inventory';
import { locateItems } from '../../models/item-locator';
import { Badge, Button, EmptyState, Field, SectionHead, SelectInput, Sprite, TextInput } from '../ui';
import { EquipmentReservations } from '../inventory/EquipmentReservations';
import { SharedEquipmentPlanner } from '../inventory/SharedEquipmentPlanner';
import { CharacterInventoryCard } from '../inventory/CharacterInventoryCard';
import styles from './InventoryPage.module.scss';

export interface InventoryPageProps {
  members: PartyMember[] | null;
  catalog?: Catalog;
  deployments?: DeploymentsResponse;
  profile?: Profile;
  loading: boolean;
}

/** Detailed view of each party character's live inventory bag, equipment, and stand listings. */
export function InventoryPage({ members, catalog, deployments, profile, loading }: InventoryPageProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string>('all');
  const [search, setSearch] = useState<string>(() => { try { const query = sessionStorage.getItem('alcc:inventory-query') ?? ''; sessionStorage.removeItem('alcc:inventory-query'); return query; } catch { return ''; } });

  useEffect(() => { const update = (event: Event) => { setSearch((event as CustomEvent<string>).detail); sessionStorage.removeItem('alcc:inventory-query'); }; window.addEventListener('alcc:inventory-search', update); return () => window.removeEventListener('alcc:inventory-search', update); }, []);
  const wealth = computePartyWealth(members);
  const locations = locateItems(search, members, catalog, deployments, profile, selectedCharacter);
  const locatedQuantity = locations.reduce((total, item) => total + item.quantity, 0);

  const characterOptions = [
    { value: 'all', label: 'All Characters' },
    ...(members?.map(m => ({ value: m.name, label: `${m.name} (${m.class})` })) ?? []),
  ];

  const filteredMembers = (members ?? []).filter(m => {
    if (selectedCharacter !== 'all' && m.name !== selectedCharacter) return false;
    return true;
  });

  const resetFilters = () => {
    setSelectedCharacter('all');
    setSearch('');
  };

  return (
    <section aria-label="Character inventory viewer">
      <SectionHead eyebrow="Real-time player gear & bags" title="Inventories">
        <Badge variant="success">{wealth.activeCharacters} Active / {members?.length ?? 0} Party</Badge>
        <Badge>🪙 {wealth.totalGold.toLocaleString()} Party Gold</Badge>
      </SectionHead>

      <p className={styles.description}>
        Inspect live bag contents (42 slots), equipment slots, and stand trade listings for all deployed characters.
      </p>


      <EquipmentProtectionInspector profile={profile} deployments={deployments} catalog={catalog} />
      {/* Wealth & Capacity Overview Cards */}
      <div className={styles.summaryCards}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Party Gold</span>
          <span className={`${styles.statValue} ${styles.gold}`}>🪙 {wealth.totalGold.toLocaleString()}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Bag Capacity Used</span>
          <span className={styles.statValue}>
            {wealth.totalOccupiedSlots} / {wealth.totalCapacity} slots
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Equipped Gear</span>
          <span className={styles.statValue}>{wealth.totalEquipment} pieces</span>
        </div>
      </div>

      {/* Filter controls */}
      <div className={styles.tools}>
        <Field label="Filter by character" htmlFor="inv-character">
          <SelectInput
            id="inv-character"
            value={selectedCharacter}
            onChange={setSelectedCharacter}
            options={characterOptions}
          />
        </Field>
        <Field label="Search item" htmlFor="inv-search">
          <TextInput
            id="inv-search"
            type="search"
            value={search}
            onChange={setSearch}
            placeholder="Search item name across characters…"
          />
        </Field>
        <Button
          variant="ghost"
          onClick={resetFilters}
          disabled={selectedCharacter === 'all' && !search}
        >
          Reset filters
        </Button>
      </div>

      <details className={styles.reservationDrawer}>
        <summary>Shared equipment · simultaneous build allocation</summary>
        <SharedEquipmentPlanner profile={profile} deployments={deployments} catalog={catalog} />
      </details>
      <details className={styles.reservationDrawer}>
        <summary>Equipment reservations · builds and protected gear</summary>
        <EquipmentReservations profile={profile} deployments={deployments} catalog={catalog} />
      </details>

      {loading && <EmptyState title="Loading character inventories…" />}
      {!loading && !catalog && (
        <EmptyState title="Catalog unavailable" description="Use Refresh to retry the server connection." />
      )}
      {!loading && catalog && filteredMembers.length === 0 && (
        <EmptyState title="No character selected" description="Adjust your filters." />
      )}

      {!loading && catalog && filteredMembers.length > 0 && (
        search.trim() ? (
          <div className={styles.locator} aria-live="polite">
            <div className={styles.locatorHead}><strong>{locations.length} location{locations.length === 1 ? '' : 's'}</strong><span>{locatedQuantity.toLocaleString()} total units</span></div>
            {locations.length === 0 ? <EmptyState title="Item not found" description="No matching owned item appears in current bags, equipment, stand sales or the latest bank snapshot." /> : locations.map(item => (
              <article key={item.key} className={styles.locationRow}>
                <Sprite id={`item:${item.item}`} catalog={catalog} label={item.displayName} size={40} />
                <div className={styles.locationIdentity}><strong>{item.displayName}{item.level ? ` +${item.level}` : ''}</strong><code>{item.item}</code></div>
                <div className={styles.locationPlace}><strong>{item.owner}</strong><span>{item.location}</span></div>
                <Badge variant="info">×{item.quantity.toLocaleString()}</Badge>
                <div className={styles.reservations}>{item.reservations.map(label => <Badge key={label} variant="warning">{label}</Badge>)}</div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.characterGrid}>
            {filteredMembers.map(member => <CharacterInventoryCard key={member.name} member={member} catalog={catalog} />)}
          </div>
        )
      )}
    </section>
  );
}
