import { existsSync } from 'fs';
import { join } from 'path';

export function bundledAssetPath(fileName: string): string | null {
  const names = [fileName.replace(/\\/g, '/')];
  const roots = [join(__dirname, 'bundled'), join(__dirname, '..', 'src', 'training', 'bundled')];
  for (const root of roots) {
    for (const name of names) {
      const absolute = join(root, name);
      if (existsSync(absolute)) return absolute;
    }
  }
  return null;
}

export function bundledAssetsForNr(nrLabel: string): Record<string, string> {
  const nr = (nrLabel || '').toUpperCase();
  const map: Record<string, string> = {};
  const footer = bundledAssetPath('inseg-footer.png');
  const header = bundledAssetPath('inseg-header.png');
  if (footer) map.FOOTER = footer;
  if (header) map.BANNER = header;
  if (nr.includes('35')) {
    const logo = bundledAssetPath('nr35-logo.png');
    const badge = bundledAssetPath('nr35-badge.png');
    if (logo) map.LEFT_LOGO = logo;
    if (badge) map.SEAL = badge;
  } else {
    const logo = bundledAssetPath('integracao-logo.png');
    if (logo) map.LEFT_LOGO = logo;
  }
  return map;
}
