import { useState } from 'react';
import type { Profile, Catalog, DeploymentsResponse } from '../../types';
import { Badge, Button, Field, ItemMultiSelect, NumberInput, Sprite, Toggle } from '../ui';
import { CollapsiblePanel } from '../merchant/CollapsiblePanel';
import styles from './AutomationPanels.module.scss';

export function CommercialGoals({ profile, catalog, deployments, disabled, onChange }: { profile: Profile; catalog: Catalog; deployments?: DeploymentsResponse; disabled: boolean; onChange: (profile: Profile) => void }) {
  const [items, setItems] = useState<string[]>([]), [quantity, setQuantity] = useState<number | null>(10), [budget, setBudget] = useState<number | null>(1000000);
  const [error, setError] = useState('');
  const merchant = profile.characters.find(c => c.enabled && c.ctype === 'merchant');
  const telemetry = merchant && deployments?.characters[merchant.name]?.telemetry;
  const recipeCatalog = { ...catalog, items: catalog.items.filter(item => catalog.recipes?.[item.id]) };
  const update = (commercialGoals: Profile['automation']['commercialGoals']) => onChange({ ...profile, automation: { ...profile.automation, commercialGoals } });
  const add = () => {
    if (items.some(item => profile.automation.commercialGoals.some(goal => goal.enabled && goal.item === item))) { setError('An active objective already exists for this recipe.'); return; }
    update([...profile.automation.commercialGoals, ...items.map(item => ({ id: crypto.randomUUID(), enabled: true, item, quantity: quantity!, budget: budget! }))]); setItems([]); setError('');
  };
  return <CollapsiblePanel id="merchant-goals" eyebrow="Bounded production" title="Commercial objectives">
    <p className={styles.help}>Produce a fixed number of new items, one craft at a time. Each recipe has a total budget covering NPC ingredients and craft fees; existing materials are not purchased from players. Goals use the craft gold reserve, stop at completion and keep their outputs protected. Progress survives CODE restarts on the same game browser.</p>
    <div className={styles.form}>
      <Field label="Recipes to produce" htmlFor="commercial-items"><ItemMultiSelect id="commercial-items" catalog={recipeCatalog} values={items} disabled={disabled} onChange={setItems} /></Field>
      <Field label="Units per recipe" htmlFor="commercial-quantity"><NumberInput id="commercial-quantity" min={1} max={9999} value={quantity} disabled={disabled} onChange={setQuantity} /></Field>
      <Field label="Total budget per recipe" htmlFor="commercial-budget"><NumberInput id="commercial-budget" min={0} max={2e12} value={budget} disabled={disabled} onChange={setBudget} /></Field>
      <Button disabled={disabled || !items.length || !quantity || budget === null || profile.automation.commercialGoals.length + items.length > 30} onClick={add}>Add production goals</Button>
    </div>
    {error && <p role="alert">{error}</p>}
    <div className={styles.rules}>{profile.automation.commercialGoals.map(goal => {
      const recipe = catalog.recipes?.[goal.item], status = telemetry?.runtimePolicy?.commerce.find(g => g.id === goal.id);
      return <article key={goal.id} className={styles.rule}>
        <div className={styles.metric}><Sprite id={`item:${goal.item}`} catalog={catalog} label={goal.item} size={32} /><strong>{goal.item}</strong><Badge variant={status?.state === 'complete' ? 'success' : 'info'}>{status?.held ?? 0} / {goal.quantity} produced</Badge></div>
        <p>{recipe ? recipe.ingredients.map(i => `${i.quantity * goal.quantity}× ${i.item} +${i.level}`).join(' + ') : 'Recipe unavailable'} · craft fees: {((recipe?.cost ?? 0) * goal.quantity).toLocaleString()} gold</p>
        <p>{status?.state ?? 'Awaiting deployment'}{telemetry?.live === false ? ' · stale report' : ''} · {Math.round(status?.spent ?? 0).toLocaleString()} / {goal.budget.toLocaleString()} gold spent</p>
        <div className={styles.form}><Field label="Production target" htmlFor={`commercial-target-${goal.id}`}><NumberInput id={`commercial-target-${goal.id}`} min={1} max={9999} value={goal.quantity} disabled={disabled} onChange={n => n !== null && update(profile.automation.commercialGoals.map(g => g.id === goal.id ? { ...g, quantity: n } : g))} /></Field><Field label="Budget" htmlFor={`commercial-cap-${goal.id}`}><NumberInput id={`commercial-cap-${goal.id}`} min={0} max={2e12} value={goal.budget} disabled={disabled} onChange={n => n !== null && update(profile.automation.commercialGoals.map(g => g.id === goal.id ? { ...g, budget: n } : g))} /></Field></div>
        <div className={styles.actions}><Toggle label="Enabled" value={goal.enabled} disabled={disabled} onChange={enabled => update(profile.automation.commercialGoals.map(g => g.id === goal.id ? { ...g, enabled } : g))} /><Button variant="ghost" disabled={disabled} onClick={() => update(profile.automation.commercialGoals.map(g => g.id === goal.id ? { ...g, id: crypto.randomUUID() } : g))}>New production run</Button><Button variant="ghost" disabled={disabled} onClick={() => update(profile.automation.commercialGoals.filter(g => g.id !== goal.id))}>Remove</Button></div>
      </article>;
    })}</div>
  </CollapsiblePanel>;
}
