import { api } from '../../api/client';
import { useMemo, useState } from 'react';
import type { Profile } from '../../../shared/schema';
import { addCraftRule, removeCraftRule, setCraftEnabled, setCraftReserveGold } from '../../models/merchant';
import type { Catalog } from '../../types';
import { Button, Field, ItemMultiSelect, NumberInput, Sprite, Toggle } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './CraftPanel.module.scss';

interface Props {
  profile: Profile;
  catalog: Catalog;
  pending: boolean;
  onChange: (profile: Profile) => void;
}

const gold = (value: number) => value.toLocaleString('fr-FR');

/** Recipe-aware editor. Runtime crafts a single result per pass and re-checks inventory after every craft. */
export function CraftPanel({ profile, catalog, pending, onChange }: Props) {
  const recipes = catalog.recipes ?? {};
  const names = useMemo(() => new Map(catalog.items.map(item => [item.id, item.name])), [catalog.items]);
  const recipeCatalog = { ...catalog, items: catalog.items.filter(item => recipes[item.id]) };
  const [items, setItems] = useState<string[]>(recipes.wingedboots ? ['wingedboots'] : []);
  const [pausePending,setPausePending]=useState<string|null>(null);
  const [pauseError,setPauseError]=useState('');
  const configured = profile.seller.craft.rules;

  const updateRule = (item: string, patch: { paused?: boolean; useBank?: boolean; batchSize?: number }) => onChange({ ...profile, seller: { ...profile.seller, craft: { ...profile.seller.craft, rules: configured.map(rule => rule.item === item ? { ...rule, ...patch } : rule) } } });

  return (
    <CollapsiblePanel id="merchant-craft" eyebrow="Leo recipe queue" title="Craft workshop" actions={
        <Toggle label="Enable crafting" value={profile.seller.craft.enabled} disabled={pending} onChange={value => onChange(setCraftEnabled(profile, value))} />
      }>
      <p className={styles.help}>The merchant buys missing NPC ingredients only when the other ingredients are ready, walks to Leo, then crafts one item per action. Batch size controls ingredient provisioning; set a total quantity in Production contracts.</p>
      <div className={styles.formGrid}>
        <Field label="Gold reserve" htmlFor="craft-reserve"><NumberInput id="craft-reserve" min={0} max={2000000000000} value={profile.seller.craft.reserveGold} disabled={pending} onChange={value => value !== null && onChange(setCraftReserveGold(profile, value))} /></Field>
        <Field label="Recipes" htmlFor="craft-recipe"><ItemMultiSelect id="craft-recipe" catalog={recipeCatalog} values={items} disabled={pending} onChange={setItems} /></Field>
        <Button size="small" variant="secondary" disabled={pending || !items.length} onClick={() => { onChange(items.reduce(addCraftRule, profile)); setItems([]); }}>Add recipes</Button>
      </div>
      {pauseError&&<p role="alert">{pauseError}</p>}
      <div className={styles.rules}>
        {configured.length === 0 ? <p className={styles.empty}>No craft recipe configured.</p> : configured.map(rule => {
          const recipe = recipes[rule.item];
          return (
            <article key={rule.item}>
              <Sprite id={`item:${rule.item}`} catalog={catalog} label={names.get(rule.item) ?? rule.item} size={44} />
              <div>
                <strong>{names.get(rule.item) ?? rule.item}</strong>
                <span>{recipe ? recipe.ingredients.map(part => `${part.quantity}× ${names.get(part.item) ?? part.item}${part.level ? ` +${part.level}` : ''}`).join(' + ') : 'Recipe unavailable in the current catalog'}</span>
                <Toggle label="Retrieve missing ingredients from bank" value={!!rule.useBank} disabled={pending} onChange={useBank => updateRule(rule.item, { useBank })} />
                <Field label="Crafts per batch" htmlFor={`craft-batch-${rule.item}`}><NumberInput id={`craft-batch-${rule.item}`} min={1} max={500} value={rule.batchSize ?? 1} disabled={pending} onChange={value => value !== null && updateRule(rule.item, { batchSize: value })} /></Field>
                <small>{recipe ? `Leo fee: 🪙 ${gold(recipe.cost)} · crafted one by one` : rule.item}</small>
              </div>
              <div><Button size="small" variant="secondary" disabled={pending||pausePending!==null} onClick={async()=>{setPausePending(rule.item);setPauseError('');try{await api('/api/merchant/craft/pause',{item:rule.item,paused:!rule.paused});updateRule(rule.item,{paused:!rule.paused});}catch(e){setPauseError(e instanceof Error?e.message:'Pause failed');}finally{setPausePending(null);}}}>{rule.paused?'Resume':'Pause'}</Button><Button size="small" variant="ghost" disabled={pending} onClick={() => onChange(removeCraftRule(profile, rule.item))}>Remove</Button></div>
            </article>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
}
