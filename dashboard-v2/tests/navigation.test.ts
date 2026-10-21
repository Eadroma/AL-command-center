import { describe, expect, it } from 'vitest';
import { groupForPage, NAV_GROUPS, pageFromHash, routeFromHash } from '../src/models/navigation';

describe('dashboard navigation', () => {
  it('resolves every configured page from its hash', () => {
    for (const group of NAV_GROUPS) {
      for (const page of group.pages) expect(pageFromHash(`#${page.id}`)).toBe(page.id);
    }
  });

  it('falls back to Team for empty or unknown routes', () => {
    expect(pageFromHash('')).toBe('team');
    expect(pageFromHash('#unknown')).toBe('team');
  });

  it('opens legacy page hashes as Team tools', () => {
    expect(routeFromHash('#inventory')).toEqual({ page: 'team', tool: 'inventory', section: 'inventory' });
    expect(routeFromHash('#combat')).toMatchObject({ page: 'team', tool: 'insights' });
    expect(routeFromHash('#party')).toEqual({ page: 'team' });
  });

  it('finds the primary group for every sub-page', () => {
    for (const group of NAV_GROUPS) {
      for (const page of group.pages) expect(groupForPage(page.id).id).toBe(group.id);
    }
  });

  it('retains old bookmarks as contextual tools within three pages', () => {
    expect(NAV_GROUPS.map(g => g.id)).toEqual(['team','merchant','bank']);
    expect(routeFromHash('#events')).toEqual({page:'team',tool:'farming',section:'events'});
    expect(routeFromHash('#team?tool=setup&section=deployments')).toEqual({page:'team',tool:'setup',section:'deployments'});
    expect(routeFromHash('#team?tool=unknown')).toEqual({page:'team'});
  });

  it('does not expose duplicate page ids', () => {
    const ids = NAV_GROUPS.flatMap(group => group.pages.map(page => page.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
