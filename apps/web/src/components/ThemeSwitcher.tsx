'use client';

import { THEME_OPTIONS, type AppTheme } from '../lib/theme';
import { useTheme } from './ThemeProvider';

export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <label className={`theme-switcher ${className}`.trim()}>
      <span className="theme-switcher__label">Visual</span>
      <select
        className="theme-switcher__select"
        value={theme}
        aria-label="Modo de visualização"
        onChange={(event) => setTheme(event.target.value as AppTheme)}
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
