export const NAV_GROUPS = [
  { id: 'team', label: 'Team', pages: [
    { id: 'party', label: 'Party' }, { id: 'inventory', label: 'Inventory' }, { id: 'combat', label: 'Combat' },
    { id: 'operations', label: 'Operations' }, { id: 'incidents', label: 'Incidents' }, { id: 'performance', label: 'History' },
  ] },
  { id: 'farm', label: 'Farming', pages: [
    { id: 'farming', label: 'Targets' }, { id: 'events', label: 'Events' }, { id: 'cave', label: 'Cave Dreams' }, { id: 'simulator', label: 'Loot Lab' },
  ] },
  { id: 'trade', label: 'Commerce', pages: [
    { id: 'merchant', label: 'Merchant' }, { id: 'bank', label: 'Bank' },
  ] },
  { id: 'system', label: 'System', pages: [
    { id: 'deployments', label: 'Deployments' }, { id: 'activity', label: 'Activity' }, { id: 'scripts', label: 'Scripts' },
  ] },
] as const;

export type NavGroup = (typeof NAV_GROUPS)[number];
export type PageId = NavGroup['pages'][number]['id'];

const PAGE_IDS = new Set<string>(NAV_GROUPS.flatMap(group => group.pages.map(page => page.id)));

/** Resolve an external hash to a known page without letting navigation and routing drift apart. */
export function pageFromHash(hash: string): PageId {
  const candidate = hash.replace(/^#/, '');
  return PAGE_IDS.has(candidate) ? candidate as PageId : 'party';
}

export function groupForPage(page: PageId): NavGroup {
  return NAV_GROUPS.find(group => group.pages.some(item => item.id === page)) ?? NAV_GROUPS[0];
}
