import { describe, expect, it } from 'vitest';
import { groupForPage, NAV_GROUPS, pageFromHash } from '../src/models/navigation';

describe('dashboard navigation', () => {
  it('resolves every configured page from its hash', () => {
    for (const group of NAV_GROUPS) {
      for (const page of group.pages) expect(pageFromHash(`#${page.id}`)).toBe(page.id);
    }
  });

  it('falls back to Party for empty or unknown routes', () => {
    expect(pageFromHash('')).toBe('party');
    expect(pageFromHash('#unknown')).toBe('party');
  });

  it('finds the primary group for every sub-page', () => {
    for (const group of NAV_GROUPS) {
      for (const page of group.pages) expect(groupForPage(page.id).id).toBe(group.id);
    }
  });

  it('does not expose duplicate page ids', () => {
    const ids = NAV_GROUPS.flatMap(group => group.pages.map(page => page.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
