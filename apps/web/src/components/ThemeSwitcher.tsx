'use client';

import { THEME_OPTIONS, type AppTheme } from '../lib/theme';
import { useTheme } from './ThemeProvider';

export function ThemeSwitcher({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`theme-switcher ${className}`.trim()}
      role="group"
      aria-label="Tema"
    >
      <span className="theme-switcher__label">Tema</span>
      <div className="theme-switcher__seg">
        {THEME_OPTIONS.map((option) => {
          const active = theme === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`theme-switcher__btn${active ? ' is-active' : ''}`}
              aria-pressed={active}
              onClick={() => setTheme(option.id as AppTheme)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
