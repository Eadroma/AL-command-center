import { useEffect, useRef, useState } from 'react';
import { Package } from 'lucide-react';
import { canonicalItemId } from '../../../shared/schema';
import type { Catalog } from '../../types';
import styles from './Sprite.module.scss';

const CHARACTER_SKINS: Record<string, string> = {
  warrior: 'skin:mwarrior2', priest: 'skin:fpriest', ranger: 'skin:mranger2', mage: 'skin:mmage', rogue: 'skin:mrogue', merchant: 'skin:mmerchant',
};

export interface SpriteProps {
  id: string;
  catalog?: Catalog;
  label: string;
  size?: number;
  /** Disable in the details header or other purely decorative contexts. */
  inspect?: boolean;
}

/** Render one frame from a catalog sprite sheet without loading remote assets. */
export function Sprite({ id, catalog, label, size = 48, inspect = true }: SpriteProps) {
  const normalized = id.startsWith('item:') ? `item:${canonicalItemId(id.slice(5))}` : canonicalItemId(id);
  const ref = useRef<HTMLSpanElement>(null);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {setInteractive(inspect && normalized.startsWith('item:') && !ref.current?.parentElement?.closest('button,a,label,[role="button"],[role="option"],[role="combobox"]'));}, [inspect, normalized]);
  const open = () => window.dispatchEvent(new CustomEvent('alcc:item-details',{detail:normalized.slice(5)}));
  const interaction = {ref, role:interactive?'button':undefined, tabIndex:interactive?0:undefined, 'aria-label':interactive?`Inspect ${label}`:undefined, title:interactive?`Inspect ${label}`:undefined, onClick:interactive?(event: React.MouseEvent<HTMLSpanElement>)=>{event.stopPropagation();event.currentTarget.focus();open();}:undefined, onKeyDown:interactive?(event: React.KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();open();}}:undefined};
  const asset = catalog?.assets?.[CHARACTER_SKINS[normalized] || normalized];
  if (!asset) {
    return <span {...interaction} className={styles.fallback} style={{ width: size, height: size }} role={interactive?'button':'img'} aria-label={interactive?`Inspect ${label}`:`${label} (no sprite)`}><Package size={Math.min(size, 22)} /></span>;
  }
  const scale = Math.min(size / asset.w, size / asset.h);
  const revision = catalog?.importedAt ? `?v=${encodeURIComponent(catalog.importedAt)}` : '';
  return (
    <span {...interaction} className={styles.box} style={{ width: size, height: size }}>
      <span
        role="img"
        aria-label={label}
        style={{
          width: asset.w * scale,
          height: asset.h * scale,
          backgroundImage: `url(/assets/${asset.file}${revision})`,
          backgroundSize: `${asset.sheetWidth * scale}px ${asset.sheetHeight * scale}px`,
          backgroundPosition: `-${asset.x * scale}px -${asset.y * scale}px`,
        }}
      />
    </span>
  );
}
