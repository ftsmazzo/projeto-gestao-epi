'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

function manifestHref(pathname: string) {
  if (
    pathname.startsWith('/portal') ||
    pathname.startsWith('/enroll') ||
    pathname.startsWith('/assinar') ||
    pathname.startsWith('/plataforma')
  ) {
    return '/manifest.webmanifest';
  }
  return '/consultoria.webmanifest';
}

/** Troca o manifesto PWA: portal do cliente vs painel da consultoria. */
export function PwaManifestSwitch() {
  const pathname = usePathname();

  useEffect(() => {
    const href = manifestHref(pathname);
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }, [pathname]);

  return null;
}
