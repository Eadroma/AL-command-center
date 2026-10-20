import { standSpotBounds, standSpotDefaults, type Profile } from '../../../shared/schema';
import { clampStandSpot } from '../../models/stand-spot';
import { Button, Field, NumberInput } from '../ui';
import { CollapsiblePanel } from './CollapsiblePanel';
import styles from './MerchantTools.module.scss';
const landmarks = [{ label: 'Spawn', x: 0, y: 0 }, { label: 'Ponty', x: 106, y: -47 }, { label: 'Potions', x: -35, y: -162 }, { label: 'Bank', x: 168, y: -149 }];
export function StandSpotEditor({ profile, disabled, onChange }: { profile: Profile; disabled: boolean; onChange: (profile: Profile) => void }) {
  const spot = profile.seller.standSpot;
  const b = standSpotBounds;
  const set = (x: number, y: number) => onChange({ ...profile, seller: { ...profile.seller, standSpot: clampStandSpot(x, y) } });
  return <CollapsiblePanel id="merchant-position" eyebrow="Town square · main" title="Stand position">
    <p>Click the square or enter coordinates. Save the profile, then deploy the merchant to apply this position. This also sets the event duo assembly point.</p>
    <div className={styles.spotLayout}>
      <svg className={styles.map} viewBox={`${b.minX} ${b.minY} ${b.maxX-b.minX} ${b.maxY-b.minY}`} aria-label="Merchant stand town preview" role="img" onClick={event => {
        if (disabled) return;
        const matrix = event.currentTarget.getScreenCTM(); if (!matrix) return;
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); set(point.x, point.y);
      }}>
        <image href="/assets/maps/main-town-square.png" x={b.minX} y={b.minY} width={b.maxX-b.minX} height={b.maxY-b.minY} />
        {landmarks.map(p => <g key={p.label} transform={`translate(${p.x} ${p.y})`}><circle r="3" fill="white"/><text y="-9" textAnchor="middle">{p.label}</text></g>)}
        <g transform={`translate(${spot.x} ${spot.y})`}><circle r="12" fill="#101722" stroke="#a78bfa" strokeWidth="3"/><text y="28" textAnchor="middle">Stand</text></g>
      </svg>
      <div className={styles.fields}>
        <Field label="Stand X" htmlFor="stand-x"><NumberInput id="stand-x" value={spot.x} min={b.minX} max={b.maxX} disabled={disabled} onChange={x => x !== null && set(x, spot.y)}/></Field>
        <Field label="Stand Y" htmlFor="stand-y"><NumberInput id="stand-y" value={spot.y} min={b.minY} max={b.maxY} disabled={disabled} onChange={y => y !== null && set(spot.x, y)}/></Field>
        <p>main · {spot.x}, {spot.y}</p>
        <Button variant="ghost" disabled={disabled} onClick={() => set(standSpotDefaults.x, standSpotDefaults.y)}>Default plaza</Button>
        <Button variant="ghost" disabled={disabled} onClick={() => set(0, 0)}>Spawn</Button>
      </div>
    </div>
    <small>Map art © Adventure Land. Coordinates are restricted to the town square; the preview does not check collisions.</small>
  </CollapsiblePanel>;
}
