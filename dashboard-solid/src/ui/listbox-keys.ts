/** Keyboard movement inside a single-select listbox (WAI-ARIA pattern), kept pure for tests. */

export type ListboxAction =
  | { readonly kind: 'move'; readonly index: number }
  | { readonly kind: 'select' }
  | { readonly kind: 'close' }
  | { readonly kind: 'none' };

export function listboxAction(key: string, active: number, count: number): ListboxAction {
  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', index: Math.min(active + 1, count - 1) };
    case 'ArrowUp':
      return { kind: 'move', index: Math.max(active - 1, 0) };
    case 'Home':
      return { kind: 'move', index: 0 };
    case 'End':
      return { kind: 'move', index: count - 1 };
    case 'Enter':
    case ' ':
      return { kind: 'select' };
    case 'Escape':
    case 'Tab':
      return { kind: 'close' };
    default:
      return { kind: 'none' };
  }
}
