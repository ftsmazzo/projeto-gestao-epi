import { existsSync } from 'fs';
import { join } from 'path';

export function bundledAssetPath(fileName: string): string | null {
  const names = [fileName.replace(/\\/g, '/')];
  const roots = [
    join(__dirname, 'bundled'),
    join(__dirname, '..', 'src', 'training', 'bundled'),
  ];
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
  const inseg = bundledAssetPath('inseg-header.png');
  const footer = bundledAssetPath('inseg-footer.png');
  if (inseg) map.HEADER = inseg;
  if (footer) map.FOOTER = footer;
  if (nr.includes('35')) {
    const badge = bundledAssetPath('nr35-badge.png');
    const logo = bundledAssetPath('nr35-logo.png');
    if (badge) map.LEFT_LOGO = badge;
    if (logo) map.SEAL = logo;
  } else {
    const logo = bundledAssetPath('integracao-logo.png');
    const back = bundledAssetPath('integrar-preciso.png');
    if (logo) map.LEFT_LOGO = logo;
    if (back) map.RIGHT_LOGO = back;
  }
  return map;
}
