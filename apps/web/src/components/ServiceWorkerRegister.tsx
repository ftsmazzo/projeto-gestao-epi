'use client';

import { useEffect } from 'react';

/** Registra o SW minimo exigido para instalabilidade PWA no Chrome. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'development') {
      // Em dev o HMR + SW costuma atrapalhar; registra so em build/prod.
      return;
    }

    const onLoad = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Falha silenciosa: PWA fica sem install prompt, app web segue ok.
      });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad, { once: true });
    }
  }, []);

  return null;
}
