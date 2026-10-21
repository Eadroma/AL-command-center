import { NAV_GROUPS, type PageId, type TeamTool } from './navigation';
import type { Catalog, Profile } from '../types';
export interface SearchEntry { id: string; label: string; detail: string; page: PageId; panel?: string; tool?: TeamTool; section?: string; }
export function searchEntries(profile?: Profile, catalog?: Catalog): SearchEntry[] {
  return [
    ...NAV_GROUPS.flatMap(group => group.pages.map(page => ({ id: `page:${page.id}`, label: page.label, detail: group.label, page: page.id }))),
    {id:'team-events',label:'Events & bosses',detail:'Team farming',page:'team',tool:'farming',section:'events'},
    {id:'team-activity',label:'Activity & insights',detail:'Team performance',page:'team',tool:'insights'},
    {id:'team-setup',label:'Team setup & deployment',detail:'Team settings',page:'team',tool:'setup'},
    ...[{label:'Production contracts',panel:'production-contracts'}, {label:'Temporary characters',panel:'temporary-characters'}, {label:'Stand position',panel:'merchant-position'}, {label:'Margin calculator',panel:'merchant-margin'}, {label:'NPC sales',panel:'merchant-npc'}, {label:'Buy wishlist',panel:'merchant-buy'}, {label:'Upgrades',panel:'merchant-up'}, {label:'Craft',panel:'merchant-craft'}, {label:'Compound',panel:'merchant-compound'}].map(row => ({id:row.panel,label:row.label,detail:'Merchant settings',page:'merchant' as const,panel:row.panel})),
    {id:'equipment-protections',label:'Equipment protection inspector',detail:'Inventory',page:'team',tool:'inventory',panel:'equipment-protections'},
    ...(profile?.characters.map(c => ({id:`character:${c.name}`,label:c.name,detail:`Character · ${c.ctype}`,page:'team' as const})) ?? []),
    ...Object.entries(profile?.farming.loadouts ?? {}).flatMap(([name,board]) => Object.keys(board).map(style => ({id:`loadout:${name}:${style}`,label:`${name} · ${style}`,detail:'Combat loadout',page:'team' as const,tool:'farming' as const,section:'farming'}))),
    ...(catalog?.items.map(i => ({id:`item:${i.id}`,label:i.name,detail:`Item · ${i.id}`,page:'team' as const,tool:'inventory' as const})) ?? []),
  ];
}
export function filterSearch(entries: SearchEntry[], query: string) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(row => words.every(word => `${row.label} ${row.detail}`.toLocaleLowerCase().includes(word))).slice(0,30);
}
