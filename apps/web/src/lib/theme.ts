export const THEME_STORAGE_KEY = 'prontepi-theme';

export const THEME_OPTIONS = [
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Escuro' },
  { id: 'colorblind', label: 'Daltonismo' },
] as const;

export type AppTheme = (typeof THEME_OPTIONS)[number]['id'];

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark' || value === 'colorblind';
}

export function readStoredTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(raw) ? raw : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme =
    theme === 'dark' ? 'dark' : 'light';
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore quota / private mode
  }
}
