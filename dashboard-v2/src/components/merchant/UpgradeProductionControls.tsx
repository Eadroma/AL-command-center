import type { Profile } from '../../../shared/schema';
import type { CharacterTelemetry } from '../../types/deployments';
import { Button, Field, NumberInput, Toggle, Tooltip } from '../ui';
import styles from './MerchantPlanner.module.scss';
type Rule = Profile['seller']['upgrade']['rules'][number];
export function UpgradeProductionControls({ rule, pending, telemetry, onChange }: { rule: Rule; pending: boolean; telemetry?: CharacterTelemetry; onChange: (rule: Rule) => void }) {
  const config = rule.production;
  const patch = (change: Partial<NonNullable<Rule['production']>>) => onChange({ ...rule, production: { enabled: false, quantity: 1, budget: 0, runId: crypto.randomUUID(), ...config, ...change } });
  const progress = telemetry?.live ? telemetry.upgradeProduction?.find(row => row.item === rule.item && row.runId === config?.runId) : undefined;
  return <section className={styles.production} aria-label={`${rule.item} production budget`}>
    <Toggle label="Bounded upgrade run" value={!!config?.enabled} disabled={pending} onChange={enabled => patch({ enabled })} />
    {config?.enabled && <>
      <Field label="Finished pieces" htmlFor={`production-qty-${rule.item}`}><NumberInput id={`production-qty-${rule.item}`} value={config.quantity} min={1} max={9999} disabled={pending} onChange={n => n !== null && patch({ quantity: n })} /></Field>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <label htmlFor={`production-budget-${rule.item}`}>Material budget (gold)</label>
          <Tooltip content="Counts NPC bases bought and consumed scrolls and offerings at their catalog gold price, including carried scrolls. Not a wallet balance or an estimate of profit. Zero budget prevents new actions."><span aria-label="Material budget help">ⓘ</span></Tooltip>
        </div>
        <NumberInput id={`production-budget-${rule.item}`} value={config.budget} min={0} max={2e12} disabled={pending} onChange={n => n !== null && patch({ budget: n })} />
      </div>
      <p>{progress ? `${progress.produced}/${progress.quantity} finished · ${progress.spent.toLocaleString()}/${progress.budget.toLocaleString()} material gold${progress.pending ? ' · Unconfirmed action: run held for review' : progress.produced >= progress.quantity ? ' · Complete' : ''}` : 'No fresh progress for this saved run. Save and redeploy to apply.'}</p>
      <Button size="small" variant="ghost" disabled={pending} onClick={() => patch({ runId: crypto.randomUUID() })}>Stage a new production run</Button>
    </>}
  </section>;
}
