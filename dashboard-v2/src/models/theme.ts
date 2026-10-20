export type DashboardTheme = 'guild' | 'retro';
const key = 'alcc.dashboard.theme';

export function readTheme(): DashboardTheme {
  try { return localStorage.getItem(key) === 'retro' ? 'retro' : 'guild'; }
  catch { return 'guild'; }
}

/** Cosmetic browser preference, independent of game profiles and deployment. */
export function applyTheme(theme: DashboardTheme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(key, theme); } catch { /* Storage can be unavailable. */ }
}
