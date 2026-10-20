/** Reveals nested workspaces and the requested collapsible editor without losing drafts. */
export function openMerchantRule(id: string) {
  if (id === 'bank') { window.location.hash = 'bank'; return; }
  window.dispatchEvent(new CustomEvent('alcc:open-rule', { detail: id }));
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = document.getElementById(`${id}-title`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const trigger = target?.closest('button');
    trigger?.focus({ preventScroll: true });
  }));
}
