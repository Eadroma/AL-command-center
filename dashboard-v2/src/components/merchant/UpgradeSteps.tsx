import type { Catalog, Profile } from '../../types';
import { SelectInput, Sprite, Toggle } from '../ui';
import styles from './MerchantPlanner.module.scss';
type Rule = Profile['seller']['upgrade']['rules'][number];
/** Keys represent the source level: key 8 configures the +8 → +9 attempt. */
export function UpgradeSteps({ rule, catalog, pending, onChange }: { rule: Rule; catalog: Catalog; pending: boolean; onChange: (rule: Rule) => void }) {
  const item = catalog.items.find(item => item.id === rule.item);
  const names = new Map(catalog.items.map(item => [item.id, item.name]));
  function patch(level: number, change: Partial<NonNullable<Rule['steps']>[string]>) {
    onChange({ ...rule, steps: { ...rule.steps, [level]: { scroll: 'auto', offering: 'none', ...rule.steps?.[level], ...change } } });
  }
  return <details className={styles.stepEditor} open><summary>Scrolls & offerings by level</summary>
    <p>Defaults use the cheapest compatible scroll and no offering. Missing requested offerings hold the attempt; they are never bought automatically. Save and deploy to apply.</p>
    <table className={styles.historyTable}><thead><tr><th>Attempt</th><th>Scroll</th><th>Offering</th></tr></thead><tbody>{Array.from({ length: rule.maxLevel }, (_, level) => {
      const step = rule.steps?.[level];
      const grades = item?.grades;
      const grade = grades ? grades.reduce((n, threshold) => n + Number(level >= threshold), 0) : null;
      const suggested = grade !== null && grade <= 3 ? names.get(`scroll${grade}`) ?? `scroll${grade}` : 'Live item grade';
      const previewScroll = step?.scroll && step.scroll !== "auto" ? step.scroll : grade !== null && grade <= 3 ? `scroll${grade}` : null;
      const incompatible = grade !== null && (grade > 3 || !!step?.scroll && step.scroll !== "auto" && Number(step.scroll.slice(6)) < grade);
      return <tr key={level}><td><Toggle label={`+${level} → +${level + 1}`} value={step?.enabled !== false} disabled={pending} onChange={enabled => patch(level, { enabled })} /></td><td><div className={styles.stepChoice}>{previewScroll && <Sprite id={`item:${previewScroll}`} catalog={catalog} label={names.get(previewScroll) ?? previewScroll} size={24} />}<SelectInput id={`upgrade-scroll-${rule.item}-${level}`} aria-label={`${rule.item} +${level + 1} scroll`} value={step?.scroll ?? 'auto'} disabled={pending || step?.enabled === false} options={[{ value: 'auto', label: `Default · ${suggested}` }, ...['scroll0', 'scroll1', 'scroll2', 'scroll3'].map(id => ({ value: id, label: names.get(id) ?? id }))]} onChange={scroll => patch(level, { scroll: scroll as NonNullable<Rule['steps']>[string]['scroll'] })} /></div>{incompatible && <small role="status">Incompatible with this grade · attempt held</small>}</td><td><div className={styles.stepChoice}>{step?.offering && step.offering !== "none" && <Sprite id={`item:${step.offering}`} catalog={catalog} label={names.get(step.offering) ?? step.offering} size={24} />}<SelectInput id={`upgrade-offering-${rule.item}-${level}`} aria-label={`${rule.item} +${level + 1} offering`} value={step?.offering ?? 'none'} disabled={pending || step?.enabled === false} options={[{ value: 'none', label: 'None' }, { value: 'offeringp', label: names.get('offeringp') ?? 'Primling' }, { value: 'offering', label: names.get('offering') ?? 'Primordial Essence' }]} onChange={offering => patch(level, { offering: offering as NonNullable<Rule['steps']>[string]['offering'] })} /></div></td></tr>;
    })}</tbody></table>
  </details>;
}
