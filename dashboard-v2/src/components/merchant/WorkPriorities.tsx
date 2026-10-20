import type { Profile } from '../../../shared/schema';
import { Button } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantPlanner.module.scss';
const names = { bank: 'Bank deposits', sell: 'NPC sales', exchange: 'Exchanges', craft: 'Crafts', compound: 'Compounds', upgrade: 'Upgrades' };
export function WorkPriorities({ profile, pending, onChange }: { profile: Profile; pending: boolean; onChange: (profile: Profile) => void }) {
  function move(index: number, direction: number) {
    const workOrder = [...profile.seller.workOrder];
    [workOrder[index], workOrder[index + direction]] = [workOrder[index + direction], workOrder[index]];
    onChange({ ...profile, seller: { ...profile.seller, workOrder } });
  }
  return <CollapsiblePanel id="merchant-priorities" title="Task priorities" eyebrow="First ready task wins">
    <p>Top to bottom. An exchange visit or craft batch finishes before switching tasks. Revival, event cleanup and transactions already in progress keep precedence.</p>
    <ol>{profile.seller.workOrder.map((task, index) => <li key={task} className={styles.priorityRow}><strong>{names[task]}</strong><Button size="small" variant="ghost" disabled={pending || index === 0} onClick={() => move(index, -1)} aria-label={`Raise ${names[task]}`}>↑</Button><Button size="small" variant="ghost" disabled={pending || index === profile.seller.workOrder.length - 1} onClick={() => move(index, 1)} aria-label={`Lower ${names[task]}`}>↓</Button></li>)}</ol>
  </CollapsiblePanel>;
}
