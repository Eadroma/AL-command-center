import { useState } from 'react';
import { applyTheme, readTheme, type DashboardTheme } from '../../models/theme';
import styles from './ThemeSelector.module.scss';

export function ThemeSelector() {
  const [theme, setTheme] = useState(readTheme);
  return <label className={styles.selector}>
    <span>Theme</span>
    <select aria-label="Dashboard theme" value={theme} onChange={event => {
      const next = event.target.value as DashboardTheme;
      applyTheme(next);
      setTheme(next);
    }}>
      <option value="guild">Guild · Clean</option>
      <option value="retro">Retro · Original</option>
    </select>
  </label>;
}
