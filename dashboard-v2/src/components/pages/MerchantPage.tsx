import { BankStandPicker } from '../merchant/BankStandPicker';
import { WorkPriorities } from '../merchant/WorkPriorities';
import { ProductionContracts } from '../merchant/ProductionContracts';
import { TemporaryCharacters } from '../events/TemporaryCharacters';
import { MerchantMarginCalculator } from '../merchant/MerchantMarginCalculator';
import { StandSpotEditor } from '../merchant/StandSpotEditor';
import { CompoundPanel } from '../merchant/CompoundPanel';
import { UpgradeReview } from '../merchant/UpgradeReview';
import { UpgradeTargets } from '../merchant/UpgradeTargets';
import { UpgradeSimulator } from '../merchant/UpgradeSimulator';
import { WorkspaceSections } from '../layout/WorkspaceSections';
import { lazy, Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { kitSlots, type Profile } from '../../../shared/schema';
import { isValidItemId } from '../../models/farming';
import {
  addBuyOrder,
  addExchangeItem,
  addNpcItem,
  addPontyItem,
  addStandListing,
  removeBuyOrder,
  removeExchangeItem,
  removeGiftRule,
  removeKitRule,
  removeNpcItem,
  removePontyItem,
  removeStandListing,
  setBuyOrdersEnabled,
  setBuyBudget,
  setBuyReserveGold,
  setExchangeEnabled,
  setGiftRule,
  setKitRule,
  setNpcEnabled,
  setPontyEnabled,
  setPontyMinGold,
  setSellerBoardEnabled,
  setStandEnabled,
  setSoloGuardEnabled,
  supervisedCharacters,
  toggleSupervisedCharacter,
  setTeamSupervisorEnabled,
  setUpgradeEnabled,
  setUpgradeMinGold,
  setUpgradeRule,
  updateBuyOrder,
} from '../../models/merchant';
import type { Catalog, DeploymentsResponse } from '../../types';
import { CommercialGoals } from '../automation/CommercialGoals';
import type { PartyMember } from '../../types/party';
import { ConsumablesPanel } from '../merchant/ConsumablesPanel';
import { CraftPanel } from '../merchant/CraftPanel';
import { MerchantPlanner } from '../merchant/MerchantPlanner';
import { CollapsiblePanel } from '../merchant/CollapsiblePanel';
import { Badge, Button, EmptyState, Field, ItemMultiSelect, NumberInput, SectionHead, SelectInput, Sprite, Toggle } from '../ui';
import styles from './MerchantPage.module.scss';

interface Props {
  deployments?: DeploymentsResponse;
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
  members?: PartyMember[] | null;
  onChange: (profile: Profile) => void;
  onSave: () => void;
  onDiscard: () => void;
  onDeploy: () => void;
}

const SLOT_OPTIONS = kitSlots.map(value => ({ value, label: value }));
const MerchantOperations = lazy(() => import('../merchant/MerchantOperations').then(module => ({ default: module.MerchantOperations })));
/** Complete merchant logistics editor for equipment handoffs, recurring supplies, NPC auto-sell, Xyn, Upgrades, Ponty, and Stand. */
export function MerchantPage({
  profile, catalog, version, loading, dirty, conflict, pending, deploymentBusy,
  error, notice, members, deployments, onChange, onSave, onDiscard, onDeploy,
}: Props) {
  const farmers = profile?.characters.filter(character => character.ctype !== 'merchant') ?? [];
  const enabledFarmers = farmers.filter(character => character.enabled);
  const [kitCharacter, setKitCharacter] = useState(farmers[0]?.name ?? '');
  const [kitSlot, setKitSlot] = useState<(typeof kitSlots)[number]>('mainhand');
  const [kitItems, setKitItems] = useState<string[]>([]);
  const [kitLevel, setKitLevel] = useState<number | null>(0);
  const [kitShiny, setKitShiny] = useState(false);

  const [giftCharacter, setGiftCharacter] = useState(farmers[0]?.name ?? '');
  const [giftItems, setGiftItems] = useState<string[]>([]);
  const [giftLevel, setGiftLevel] = useState<number | null>(0);
  const [giftQty, setGiftQty] = useState<number | null>(1);

  // New sub-systems local state
  const [npcItems, setNpcItems] = useState<string[]>([]);
  const [exItems, setExItems] = useState<string[]>([]);
  const [exMin, setExMin] = useState<number | null>(1);

  const [upItems, setUpItems] = useState<string[]>([]);
  const [upMaxLevel, setUpMaxLevel] = useState<number | null>(7);

  const [pontyItems, setPontyItems] = useState<string[]>([]);

  const [standItems, setStandItems] = useState<string[]>([]);
  const [standLevel, setStandLevel] = useState<number | null>(0);
  const [standPrice, setStandPrice] = useState<number | null>(1000000);

  const [buyItems, setBuyItems] = useState<string[]>([]);
  const [buyLevel, setBuyLevel] = useState<number | null>(0);
  const [buyPrice, setBuyPrice] = useState<number | null>(500000);
  const [buyQty, setBuyQty] = useState<number | null>(10);

  const names = useMemo(() => new Map(catalog?.items.map(item => [item.id, item.name]) ?? []), [catalog]);

  if (loading) return <section aria-label="Merchant logistics"><SectionHead eyebrow="Mule and supplies" title="Merchant" /><EmptyState title="Loading merchant rules…" /></section>;
  if (!profile || !catalog) return <section aria-label="Merchant logistics"><SectionHead eyebrow="Mule and supplies" title="Merchant" /><EmptyState title="Profile unavailable" description="Use Refresh to retry the server connection." /></section>;

  const characterOptions = farmers.map(character => ({ value: character.name, label: `${character.name} · ${character.ctype}` }));
  const kitTarget = farmers.some(character => character.name === kitCharacter) ? kitCharacter : farmers[0]?.name ?? '';
  const giftTarget = farmers.some(character => character.name === giftCharacter) ? giftCharacter : farmers[0]?.name ?? '';
  const canDeploy = !pending && !dirty && !conflict && !deploymentBusy && profile.characters.some(character => character.enabled);
  const merchantGold = members?.find(member => member.class === 'merchant')?.gold ?? null;
  const buyCapacity = merchantGold === null
    ? profile.seller.buy.budget
    : Math.min(profile.seller.buy.budget, Math.max(0, merchantGold - profile.seller.buy.reserveGold));
  const cheapestBuy = profile.seller.buy.orders.reduce((best, order) => Math.min(best, order.price), Number.POSITIVE_INFINITY);
  const buyBudgetBlocked = profile.seller.buy.enabled && profile.seller.buy.orders.length > 0 && buyCapacity < cheapestBuy;
  const label = (id: string) => names.get(id) ?? id;
  const supervisedNames = supervisedCharacters(profile);
  const setSupervised = (name: string, enabled: boolean) => {
    onChange(toggleSupervisedCharacter(profile, name, enabled));
  };

  const addKit = () => {
    const item = kitItems[0];
    if (!kitTarget || !isValidItemId(item)) return;
    onChange(setKitRule(profile, { character: kitTarget, slot: kitSlot, item, minLevel: kitLevel ?? 0, shiny: kitShiny }));
    setKitItems([]);
  };
  const addGift = () => {
    if (!giftTarget || !giftItems.length || !giftQty) return;
    onChange(giftItems.reduce((next, item) => setGiftRule(next, { character: giftTarget, item, level: giftLevel ?? 0, quantity: giftQty }), profile));
    setGiftItems([]);
  };

  const addNpc = () => {
    if (!npcItems.length) return;
    onChange(npcItems.reduce(addNpcItem, profile));
    setNpcItems([]);
  };

  const addExchange = () => {
    if (!exItems.length) return;
    onChange(exItems.reduce((next, item) => addExchangeItem(next, item, exMin ?? 1), profile));
    setExItems([]);
  };

  const addUpgrade = () => {
    if (!upItems.length) return;
    onChange(upItems.reduce((next, item) => setUpgradeRule(next, item, upMaxLevel ?? 7), profile));
    setUpItems([]);
  };

  const addPonty = () => {
    if (!pontyItems.length) return;
    onChange(pontyItems.reduce(addPontyItem, profile));
    setPontyItems([]);
  };

  const addStand = () => {
    if (!standItems.length || !standPrice) return;
    onChange(standItems.reduce((next, item) => addStandListing(next, { item, level: standLevel ?? 0, price: standPrice }), profile));
    setStandItems([]);
  };

  const addBuy = () => {
    if (!buyItems.length || !buyPrice || !buyQty) return;
    onChange(buyItems.slice(0, Math.max(0, 8 - profile.seller.buy.orders.length)).reduce((next, item) => addBuyOrder(next, { item, level: buyLevel ?? 0, price: buyPrice, quantity: buyQty }), profile));
    setBuyItems([]);
  };

  return (
    <section aria-label="Merchant logistics">
      <SectionHead eyebrow="Mule and supplies" title="Merchant logistics">
        <Badge variant="info">Revision {version}</Badge>
        <Badge variant={profile.seller.standEnabled ? 'success' : 'neutral'}>{profile.seller.standEnabled ? 'Stand enabled' : 'Stand paused'}</Badge>
      </SectionHead>
      <p className={styles.description}>Configure what EadroSell keeps, retrieves, trades, upgrades, and delivers.</p>
      <WorkspaceSections label="Merchant workspace" sections={[
        { id: 'follow', label: 'Live overview', description: 'Current activity, next actions and blockers.', content: <Suspense fallback={<EmptyState title="Loading merchant operations…" />}><MerchantOperations profile={profile} catalog={catalog} deployments={deployments} dirty={dirty} /></Suspense> },
        { id: 'settings', label: 'Settings', description: 'Configure trading, production and team rules.', content: <>
      <WorkspaceSections label="Merchant settings" sections={[
        { id: 'overview', label: 'Overview', description: 'Inspect the task planner and configure which farmers the merchant supervises.', content: <>
        <WorkPriorities profile={profile} pending={pending} onChange={onChange} />
      <TemporaryCharacters profile={profile} deployments={deployments} />
      <CollapsiblePanel id="merchant-team" eyebrow="Runtime control" title="Team supervisor" defaultOpen actions={<Toggle label="Auto-start farmers" value={profile.seller.teamSupervisor.enabled} disabled={pending} onChange={value => onChange(setTeamSupervisorEnabled(profile, value))} />}>
        <p className={styles.help}>Choose which enabled characters EadroSell may restart. This selection is enforced in the generated merchant bundle.</p>
        <div className={styles.guardRow}>
          <Toggle label="Solo guard" value={profile.seller.teamSupervisor.soloGuard} disabled={pending || (!profile.seller.teamSupervisor.soloGuard && supervisedNames.length !== 1)} onChange={value => onChange(setSoloGuardEnabled(profile, value))} />
          <span>Warn when another farmer comes online or the selected ranger loses Lone Wolf. Select exactly one character to enable this guard.</span>
        </div>
        <div className={styles.toggleGrid}>
          {enabledFarmers.map(character => <Toggle key={character.name} label={`${character.name} · ${character.ctype}`} value={supervisedNames.includes(character.name)} disabled={pending || !profile.seller.teamSupervisor.enabled} onChange={value => setSupervised(character.name, value)} />)}
        </div>
      </CollapsiblePanel>

      {/* 1. Kit deliveries */}
        </> },
        { id: 'supplies', label: 'Team supplies', description: 'Configure equipment delivery, consumables and permanent gifts.', content: <>
      <CollapsiblePanel id="merchant-kit" eyebrow="Equipment handoff" title="Kit board" actions={<Toggle label="Enable kit delivery" value={profile.seller.kit.enabled} disabled={pending} onChange={value => onChange(setSellerBoardEnabled(profile, 'kit', value))} />}>
        <p className={styles.help}>One rule per character and slot. Saving another item for the same slot replaces the previous rule.</p>
        <div className={styles.formGrid}>
          <Field label="Character" htmlFor="kit-character"><SelectInput id="kit-character" value={kitTarget} disabled={pending} onChange={setKitCharacter} options={characterOptions} /></Field>
          <Field label="Slot" htmlFor="kit-slot"><SelectInput id="kit-slot" value={kitSlot} disabled={pending} onChange={value => setKitSlot(value as typeof kitSlot)} options={SLOT_OPTIONS} /></Field>
          <ItemField id="kit-item" values={kitItems} catalog={catalog} pending={pending} max={1} onChange={setKitItems} />
          <Field label="Minimum +" htmlFor="kit-level"><NumberInput id="kit-level" min={0} max={15} value={kitLevel} disabled={pending} onChange={setKitLevel} /></Field>
          <Toggle label="Require shiny" value={kitShiny} disabled={pending} onChange={setKitShiny} />
          <Button size="small" variant="secondary" disabled={pending || !kitTarget || !kitItems.length} onClick={addKit}>Add or replace</Button>
        </div>
        <RuleGrid empty="No kit deliveries configured.">{profile.seller.kit.rules.map(rule => <RuleCard key={`${rule.character}:${rule.slot}`} catalog={catalog} item={rule.item} title={`${rule.character} · ${rule.slot}`} detail={`${label(rule.item)} +${rule.minLevel}${rule.shiny ? ' · shiny' : ''}`} pending={pending} onRemove={() => onChange(removeKitRule(profile, rule.character, rule.slot))} />)}</RuleGrid>
      </CollapsiblePanel>

      <ConsumablesPanel profile={profile} catalog={catalog} farmers={farmers} members={members} pending={pending} onChange={onChange} />

      <CollapsiblePanel id="merchant-gifts" eyebrow="Give and keep" title="Permanent gifts" actions={<Toggle label="Enable gifts" value={profile.seller.gifts.enabled} disabled={pending} onChange={value => onChange(setSellerBoardEnabled(profile, 'gifts', value))} />}>
        <div className={styles.formGrid}>
          <Field label="Character" htmlFor="gift-character"><SelectInput id="gift-character" value={giftTarget} disabled={pending} onChange={setGiftCharacter} options={characterOptions} /></Field>
          <ItemField id="gift-item" values={giftItems} catalog={catalog} pending={pending} onChange={setGiftItems} />
          <Field label="Exact level" htmlFor="gift-level"><NumberInput id="gift-level" min={0} max={15} value={giftLevel} disabled={pending} onChange={setGiftLevel} /></Field>
          <Field label="Quantity" htmlFor="gift-qty"><NumberInput id="gift-qty" min={1} max={9999} value={giftQty} disabled={pending} onChange={setGiftQty} /></Field>
          <Button size="small" variant="secondary" disabled={pending || !giftTarget || !giftItems.length || !giftQty} onClick={addGift}>Add or replace</Button>
        </div>
        <RuleGrid empty="No permanent gifts configured.">{profile.seller.gifts.rules.map(rule => <RuleCard key={`${rule.character}:${rule.item}:${rule.level}`} catalog={catalog} item={rule.item} title={rule.character} detail={`${label(rule.item)} +${rule.level} ×${rule.quantity}`} pending={pending} onRemove={() => onChange(removeGiftRule(profile, rule.character, rule.item, rule.level))} />)}</RuleGrid>
      </CollapsiblePanel>

      {/* 4. Gabriel NPC Auto-Sell */}
        </> },
        { id: 'production', label: 'Production', description: 'Manage crafting, production goals, exchanges, upgrades and compound.', content: <WorkspaceSections label="Production settings" sections={[{ id: 'workshop', label: 'Workshop', description: 'Craft, exchange and upgrade targets.', content: <>
      <ProductionContracts profile={profile} catalog={catalog} deployments={deployments} disabled={pending || conflict || deploymentBusy} onChange={onChange} />
      <CraftPanel profile={profile} catalog={catalog} pending={pending} onChange={onChange} />
      <CommercialGoals profile={profile} catalog={catalog} deployments={deployments} disabled={pending || conflict || deploymentBusy} onChange={onChange} />

      {/* 3. Permanent gifts */}
      <CollapsiblePanel id="merchant-ex" eyebrow="Exchange Items at Xyn" title="Xyn Exchanges" actions={<Toggle label="Enable Exchanges" value={profile.seller.exchange.enabled} disabled={pending} onChange={value => onChange(setExchangeEnabled(profile, value))} />}>
        <div className={styles.formGrid}>
          <ItemField id="ex-item" values={exItems} catalog={catalog} pending={pending} onChange={setExItems} />
          <Field label="Minimum Stack Threshold" htmlFor="ex-min"><NumberInput id="ex-min" min={1} max={9999} value={exMin} disabled={pending} onChange={setExMin} /></Field>
          <Button size="small" variant="secondary" disabled={pending || !exItems.length} onClick={addExchange}>Add Exchange Rules</Button>
        </div>
        <p className={styles.help}>Bank batch size counts exchanges, not items. The merchant withdraws the required recipe quantity, returns any excess stack, then drains the batch at Xyn. Locked and bound bank stock is excluded.</p>
        <RuleGrid empty="No exchange items configured.">{profile.seller.exchange.items.map(item => {
          const bankRule=profile.seller.exchange.bank?.[item]??{enabled:false,batchSize:10};
          const updateBank=(patch:Partial<typeof bankRule>)=>onChange({...profile,seller:{...profile.seller,exchange:{...profile.seller.exchange,bank:{...profile.seller.exchange.bank,[item]:{...bankRule,...patch}}}}});
          return <EditableRuleCard key={item} catalog={catalog} item={item} title={label(item)} pending={pending} onRemove={() => onChange(removeExchangeItem(profile,item))}>
            <span>Min carried stack: {profile.seller.exchange.minimum[item]??1}</span>
            <Toggle label="Retrieve exchange stock from bank" hideLabel value={bankRule.enabled} disabled={pending} onChange={enabled=>updateBank({enabled})}/>
            <Field label="Exchanges per bank batch" htmlFor={`exchange-batch-${item}`}><NumberInput id={`exchange-batch-${item}`} min={1} max={500} value={bankRule.batchSize} disabled={pending||!bankRule.enabled} onChange={value=>value!==null&&updateBank({batchSize:value})}/></Field>
          </EditableRuleCard>;
        })}</RuleGrid>
      </CollapsiblePanel>

      {/* 6. Item Upgrades */}
      <CollapsiblePanel id="merchant-up" eyebrow="Automated Upgrades" title="Upgrades & Blacksmith" actions={<Toggle label="Enable Upgrades" value={profile.seller.upgrade.enabled} disabled={pending} onChange={value => onChange(setUpgradeEnabled(profile, value))} />}>
        <div style={{ marginBottom: '12px' }}>
          <Field label="Minimum Gold Reserve to Upgrade" htmlFor="up-mingold">
            <NumberInput id="up-mingold" min={0} max={1000000000} value={profile.seller.upgrade.minGold ?? 0} disabled={pending} onChange={val => onChange(setUpgradeMinGold(profile, val ?? 0))} />
          </Field>
        </div>
        <div className={styles.formGrid}>
          <ItemField id="up-item" values={upItems} catalog={catalog} pending={pending} onChange={setUpItems} />
          <Field label="Max Upgrade Level +" htmlFor="up-maxlevel"><NumberInput id="up-maxlevel" min={1} max={15} value={upMaxLevel} disabled={pending} onChange={setUpMaxLevel} /></Field>
          <Button size="small" variant="secondary" disabled={pending || !upItems.length} onClick={addUpgrade}>Set Upgrade Targets</Button>
        </div>
        <p className={styles.help}>Uses carried upgrade stock before buying. Finished equipment goes to bank at its target level, independently of the recurrent deposit list. Locked and bound items stay protected.</p>
        <UpgradeTargets profile={profile} catalog={catalog} pending={pending} telemetry={deployments?.characters[profile.characters.find(c => c.enabled && c.ctype === 'merchant')?.name ?? '']?.telemetry ?? undefined} onChange={onChange} />
      </CollapsiblePanel>

      <UpgradeReview profile={profile} catalog={catalog} deployments={deployments} />
      <UpgradeSimulator profile={profile} catalog={catalog} telemetry={deployments?.characters[profile.characters.find(c => c.enabled && c.ctype === "merchant")?.name ?? ""]?.telemetry ?? undefined} />
      {/* 7. Ponty Tours */}
        </> }, { id: 'compound', label: 'Compound', description: 'Combine items and deposit finished equipment.', content: <CompoundPanel profile={profile} catalog={catalog} pending={pending} onChange={onChange} /> }]} /> },
        { id: 'trading', label: 'Trading', description: 'Manage stand listings, wishlist orders, NPC sales and Ponty purchases.', content: <>
      <CollapsiblePanel id="merchant-stand" eyebrow="Town Stand Listings" title="Player Stand" actions={<Toggle label="Open Stand in Idle Time" value={profile.seller.standEnabled} disabled={pending} onChange={value => onChange(setStandEnabled(profile, value))} />}>
        <div className={styles.formGrid}>
          <ItemField id="stand-item" values={standItems} catalog={catalog} pending={pending} onChange={setStandItems} />
          <Field label="Item Level +" htmlFor="stand-level"><NumberInput id="stand-level" min={0} max={15} value={standLevel} disabled={pending} onChange={setStandLevel} /></Field>
          <Field label="Sale Price (Gold)" htmlFor="stand-price"><NumberInput id="stand-price" min={1} max={10000000000} value={standPrice} disabled={pending} onChange={setStandPrice} /></Field>
          <Button size="small" variant="secondary" disabled={pending || !standItems.length || !standPrice} onClick={addStand}>Add Sell Listings</Button>
        </div>
        <BankStandPicker catalog={catalog} deployments={deployments} disabled={pending} onSelect={(item, level, price) => { setStandItems([item]); setStandLevel(level); setStandPrice(price); }} />
        <p className={styles.help}>Bank reserve applies to this exact item and level. Only surplus is withdrawn, one piece at a time. Finished upgrades always pass through the bank first.</p>
        <RuleGrid empty="No stand listings configured.">{profile.seller.listings.map(listing => <EditableRuleCard key={`${listing.item}:${listing.level}`} catalog={catalog} item={listing.item} title={`${label(listing.item)} +${listing.level}`} pending={pending} onRemove={() => onChange(removeStandListing(profile, listing.item, listing.level))}><Field label="Sale price" htmlFor={`stand-price-${listing.item}-${listing.level}`}><NumberInput id={`stand-price-${listing.item}-${listing.level}`} min={1} max={2000000000000} value={listing.price} disabled={pending} onChange={value => value !== null && value > 0 && onChange(addStandListing(profile, { ...listing, price: value }))} /></Field><Field label="Minimum kept in bank" htmlFor={`stand-reserve-${listing.item}-${listing.level}`}><NumberInput id={`stand-reserve-${listing.item}-${listing.level}`} min={0} max={1000000} value={listing.bankReserve ?? 0} disabled={pending} onChange={value => value !== null && onChange(addStandListing(profile, { ...listing, bankReserve: value }))} /></Field></EditableRuleCard>)}</RuleGrid>
      </CollapsiblePanel>

      <StandSpotEditor profile={profile} disabled={pending || conflict} onChange={onChange} />
      {/* 9. Stand Buy Wishlist Orders */}
      <CollapsiblePanel id="merchant-buy" eyebrow="Wishlist Stand Buys" title="Buy Wishlist Orders" actions={<div className={styles.inlineActions}>
        {buyBudgetBlocked ? <Badge variant="warning">Budget blocks every order</Badge> : null}
        <Toggle label="Enable Buy Orders" value={profile.seller.buy.enabled} disabled={pending} onChange={value => onChange(setBuyOrdersEnabled(profile, value))} />
      </div>}>
        <p className={styles.help}>Wishlist slots use at most the buy budget while always preserving the gold reserve. Orders that cannot afford one unit are not posted.</p>
        <p className={styles.help} role="status">{profile.seller.buy.orders.length}/8 buy orders configured.{profile.seller.buy.orders.length >= 8 ? ' Wishlist full: remove an existing order before adding another item.' : ` ${8 - profile.seller.buy.orders.length} slots available.`}</p>
        <div className={styles.formGrid}>
          <Field label="Buy budget" htmlFor="buy-budget"><NumberInput id="buy-budget" min={0} max={2000000000000} value={profile.seller.buy.budget} disabled={pending} onChange={value => value !== null && onChange(setBuyBudget(profile, value))} /></Field>
          <Field label="Gold reserve" htmlFor="buy-reserve"><NumberInput id="buy-reserve" min={0} max={2000000000000} value={profile.seller.buy.reserveGold} disabled={pending} onChange={value => value !== null && onChange(setBuyReserveGold(profile, value))} /></Field>
          <ItemField id="buy-item" values={buyItems} catalog={catalog} pending={pending || profile.seller.buy.orders.length >= 8} max={Math.max(1, 8 - profile.seller.buy.orders.length)} onChange={setBuyItems} />
          <Field label="Level +" htmlFor="buy-level"><NumberInput id="buy-level" min={0} max={15} value={buyLevel} disabled={pending} onChange={setBuyLevel} /></Field>
          <Field label="Unit Price" htmlFor="buy-price"><NumberInput id="buy-price" min={1} max={10000000000} value={buyPrice} disabled={pending} onChange={setBuyPrice} /></Field>
          <Field label="Quantity" htmlFor="buy-qty"><NumberInput id="buy-qty" min={1} max={1000} value={buyQty} disabled={pending} onChange={setBuyQty} /></Field>
          <Button size="small" variant="secondary" disabled={pending || profile.seller.buy.orders.length >= 8 || !buyItems.length || !buyPrice || !buyQty} onClick={addBuy}>{profile.seller.buy.orders.length >= 8 ? 'Wishlist full · 8/8' : 'Add Buy Orders'}</Button>
        </div>
        <p className={buyBudgetBlocked ? styles.budgetWarning : styles.budgetStatus} role={buyBudgetBlocked ? 'alert' : 'status'}>
          Available for buy orders: 🪙 {buyCapacity.toLocaleString()}{merchantGold === null ? ' · live merchant gold unavailable' : ` · merchant holds ${merchantGold.toLocaleString()}`}
          {buyBudgetBlocked ? ` · cheapest configured unit costs ${cheapestBuy.toLocaleString()}` : ''}
        </p>
        <RuleGrid empty="No buy orders configured.">{profile.seller.buy.orders.map((order, index) => {
          const original = { item: order.item, level: order.level };
          const update = (next: typeof order) => onChange(updateBuyOrder(profile, original, next));
          return <EditableRuleCard key={`${order.item}:${index}`} catalog={catalog} item={order.item} title={label(order.item)} pending={pending} onRemove={() => onChange(removeBuyOrder(profile, order.item, order.level))}>
            <Field label="Level +" htmlFor={`buy-edit-level-${order.item}-${order.level}`}><NumberInput id={`buy-edit-level-${order.item}-${order.level}`} min={0} max={15} value={order.level} disabled={pending} onChange={value => value !== null && update({ ...order, level: value })} /></Field>
            <Field label="Unit price" htmlFor={`buy-edit-price-${order.item}-${order.level}`}><NumberInput id={`buy-edit-price-${order.item}-${order.level}`} min={1} max={2000000000000} value={order.price} disabled={pending} onChange={value => value !== null && value > 0 && update({ ...order, price: value })} /></Field>
            <Field label="Quantity" htmlFor={`buy-edit-quantity-${order.item}-${order.level}`}><NumberInput id={`buy-edit-quantity-${order.item}-${order.level}`} min={1} max={9999} value={order.quantity} disabled={pending} onChange={value => value !== null && value > 0 && update({ ...order, quantity: value })} /></Field>
          </EditableRuleCard>;
        })}</RuleGrid>
      </CollapsiblePanel>

      <CollapsiblePanel id="merchant-npc" eyebrow="Town NPC Auto-Sell" title="Gabriel NPC Sales" actions={<Toggle label="Enable NPC Sales" value={profile.seller.npcEnabled} disabled={pending} onChange={value => onChange(setNpcEnabled(profile, value))} />}>
        <p className={styles.help}>Items on this allowlist will be sold to town NPCs automatically when the merchant visits town.</p>
        <div className={styles.formGrid}>
          <ItemField id="npc-item" values={npcItems} catalog={catalog} pending={pending} onChange={setNpcItems} />
          <Button size="small" variant="secondary" disabled={pending || !npcItems.length} onClick={addNpc}>Add Items to Sell</Button>
        </div>
        <RuleGrid empty="No NPC sell items configured.">{profile.seller.npcItems.map(item => <RuleCard key={item} catalog={catalog} item={item} title={label(item)} detail={`Item ID: ${item}`} pending={pending} onRemove={() => onChange(removeNpcItem(profile, item))} />)}</RuleGrid>
      </CollapsiblePanel>

      {/* 5. Xyn Exchange */}
      <CollapsiblePanel id="merchant-ponty" eyebrow="Second-Hand Shop" title="Ponty Sniping" actions={<Toggle label="Enable Ponty Tours" value={profile.seller.ponty.enabled} disabled={pending} onChange={value => onChange(setPontyEnabled(profile, value))} />}>
        <div style={{ marginBottom: '12px' }}>
          <Field label="Minimum Gold Reserve for Ponty" htmlFor="ponty-mingold">
            <NumberInput id="ponty-mingold" min={0} max={1000000000} value={profile.seller.ponty.minGold ?? 200000} disabled={pending} onChange={val => onChange(setPontyMinGold(profile, val ?? 200000))} />
          </Field>
        </div>
        <div className={styles.formGrid}>
          <ItemField id="ponty-item" values={pontyItems} catalog={catalog} pending={pending} onChange={setPontyItems} />
          <Button size="small" variant="secondary" disabled={pending || !pontyItems.length} onClick={addPonty}>Add Ponty Items</Button>
        </div>
        <RuleGrid empty="No Ponty items configured.">{profile.seller.ponty.items.map(item => <RuleCard key={item} catalog={catalog} item={item} title={label(item)} detail={`Auto-buy from Ponty`} pending={pending} onRemove={() => onChange(removePontyItem(profile, item))} />)}</RuleGrid>
      </CollapsiblePanel>

      {/* 8. Player Stand Listings */}
        </> },
      ]} />

        </> },
        { id: 'tools', label: 'Planning tools', description: 'Inspect scheduling and estimate commercial margins.', content: <>
          <MerchantPlanner profile={profile} members={members} deployments={deployments} />
          <MerchantMarginCalculator profile={profile} catalog={catalog} />
        </> },
      ]} />
      {dirty && <p role="status" className={styles.notice}>Unsaved changes · save before deploying.</p>}

      {conflict && <p role="alert" className={styles.alert}>The profile changed in another window. Discard local edits before editing again.</p>}
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.actions}>
        <Button onClick={onSave} disabled={pending || !dirty || conflict || deploymentBusy}>Save profile</Button>
        <Button variant="ghost" onClick={onDiscard} disabled={pending || !dirty}>Discard edits</Button>
        <Button variant="secondary" onClick={onDeploy} disabled={!canDeploy}>{pending || deploymentBusy ? 'Operation in progress…' : 'Deploy saved profile'}</Button>
      </div>
    </section>
  );
}

function ItemField({ id, values, catalog, pending, max = 500, onChange }: { id: string; values: string[]; catalog: Catalog; pending: boolean; max?: number; onChange: (values: string[]) => void }) {
  return (
    <Field label={max === 1 ? 'Item' : 'Items'} htmlFor={id}>
      <ItemMultiSelect id={id} catalog={catalog} values={values} disabled={pending} max={max} onChange={onChange} />
    </Field>
  );
}

function RuleGrid({ children, empty }: { children: ReactNode; empty: string }) {
  const list = Array.isArray(children) ? children : [children];
  return list.length && list.some(Boolean) ? <div className={styles.rules}>{children}</div> : <p className={styles.empty}>{empty}</p>;
}

function RuleCard({ catalog, item, title, detail, pending, onRemove }: { catalog: Catalog; item: string; title: string; detail: string; pending: boolean; onRemove: () => void }) {
  return (
    <article>
      <Sprite id={`item:${item}`} catalog={catalog} label={detail} size={40} />
      <div><strong>{title}</strong><span>{detail}</span></div>
      <Button size="small" variant="ghost" disabled={pending} onClick={onRemove}>Remove</Button>
    </article>
  );
}

function EditableRuleCard({ catalog, item, title, pending, onRemove, children }: { catalog: Catalog; item: string; title: string; pending: boolean; onRemove: () => void; children: ReactNode }) {
  return (
    <article className={styles.editableRule}>
      <div className={styles.ruleHeader}><Sprite id={`item:${item}`} catalog={catalog} label={title} size={40} /><strong>{title}</strong></div>
      <div className={styles.ruleFields}>{children}</div>
      <Button size="small" variant="ghost" disabled={pending} onClick={onRemove}>Remove</Button>
    </article>
  );
}

