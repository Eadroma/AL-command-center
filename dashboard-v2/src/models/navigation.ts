/** Three destinations; supporting tools open in context instead of becoming pages. */
export const NAV_GROUPS = [
  { id: 'team', label: 'Team', pages: [{ id: 'team', label: 'Team' }] },
  { id: 'merchant', label: 'Merchant', pages: [{ id: 'merchant', label: 'Merchant' }] },
  { id: 'bank', label: 'Bank', pages: [{ id: 'bank', label: 'Bank' }] },
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];
export type PageId = NavGroup['pages'][number]['id'];
export const TEAM_TOOLS = ['setup', 'farming', 'inventory', 'insights'] as const;
export type TeamTool = typeof TEAM_TOOLS[number];
const legacyTools: Record<string, TeamTool> = {
  farming: 'farming', events: 'farming', cave: 'farming', simulator: 'insights',
  inventory: 'inventory', combat: 'insights', operations: 'insights', incidents: 'insights',
  performance: 'insights', deployments: 'setup', activity: 'insights', scripts: 'setup',
};
export function routeFromHash(hash: string): { page: PageId; tool?: TeamTool; section?: string } {
  const [name, query = ''] = hash.replace(/^#/, '').split('?');
  if (name === 'merchant' || name === 'bank') return { page: name };
  if (legacyTools[name]) return { page: 'team', tool: legacyTools[name], section: name };
  const params = new URLSearchParams(query), tool = params.get('tool');
  return { page: 'team', ...(TEAM_TOOLS.includes(tool as TeamTool) ? { tool: tool as TeamTool, section: params.get('section') ?? undefined } : {}) };
}
export function pageFromHash(hash: string): PageId { return routeFromHash(hash).page; }
export function groupForPage(page: PageId): NavGroup { return NAV_GROUPS.find(group => group.id === page) ?? NAV_GROUPS[0]; }
export function teamToolHash(tool: TeamTool, section?: string) {
  return `team?tool=${tool}${section ? `&section=${encodeURIComponent(section)}` : ''}`;
}
